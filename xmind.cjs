const fs = require('fs')
const path = require('path')
const AdmZip = require('adm-zip-iconv')

/**
 * 解压文件到指定目录
 * @param {待解压的文件} filepath 
 * @param {指定解压的目录} target 
 */
function unzip(filepath, target) {
  const zip = new AdmZip(filepath, 'gbk')
  // 检查目标解压目录是否存在，如果不存在，则创建
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true })
  }

  // 解压缩zip文件到目标目录
  zip.extractAllTo(target, /*overwrite*/ true)
  console.log(`文件${filepath}已解压缩到目标目录:${target}`)
}

function toMarkdown(filename, xmindDir, outputDir) {
  let files = fs.readdirSync(xmindDir)
  fd = fs.openSync(`${filename}.md`, 'w+')
  for (let file of files) {
    let absfile = path.join(xmindDir, file)
    // let tempFD = fs.openSync(file)
    if (fs.statSync(absfile).isDirectory()) {
      //暂时不处理
      continue
    } else {
      if (file === 'content.json') {
        let buffer = fs.readFileSync(absfile)
        let contentJsonArray = JSON.parse(buffer.toString('utf8'))
        let context = {
          name: filename,
          baseDir: xmindDir,
          outputDir: outputDir,
          fd: fd
        }

        for (let contentJson of contentJsonArray) {
          let root = contentJson.rootTopic
          traverse(context, root, 1, [])
        }
      }
    }
  }
  fs.closeSync(fd)
  console.log("转换完成")
}
function myWrite(context, content) {
  fs.writeFileSync(context.fd, content)
}
/**
 * 递归遍历节点
 */
function traverse(context, node, level, sequence) {
  if (!node) {
    return
  }

  if (node.title) {
    let prefix = signMultiplication('#', level, sequence)
    let title = `${prefix} ${node.title}\n`

    if (sequence.length == 0) {
      title = `---
title: ${node.title}
markmap:
  colorFreezeLevel: 2
  embedAssets: true
  maxWidth: 720
---\n`
    }

    console.log(title)
    myWrite(context, title)
  }

  if (node.notes && node.notes.plain.content) {
    let content = `${node.notes.plain.content}\n`
    console.log(content)
    myWrite(context, content)

  }

  if (node.image) {
    let src = node.image.src.slice(4)
    let imageTitle = node.title || "default"
    let attachmentDir = `${Buffer.from(context.name).toString('base64')}.attachment`
    let imageDir = path.join(context.outputDir, attachmentDir)
    let imageName = src.slice(src.lastIndexOf("/") + 1)
    let newImageSrc = path.join(imageDir, imageName)
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true })
    }
    let realSrc = path.join(context.baseDir, src)
    if (!fs.existsSync(newImageSrc)) {
      fs.copyFileSync(realSrc, newImageSrc)
    }
    let relateImageSrc = path.join(attachmentDir, imageName)
    let content = `![${imageTitle}](${relateImageSrc})`
    console.log(content)
    myWrite(context, content)
  }

  myWrite(context, '\n')

  if (node.children && node.children.attached && node.children.attached.length > 0) {
    let children = node.children.attached
    for (let i = 0; i < children.length; i++) {
      traverse(context, children[i], level + 1, sequence.concat([i + 1]))
    }
  }
}

/**
 * 符号乘法
 */
function signMultiplication(sign, n, sequence) {
  let result = ''

  if (sequence.length > 1) {
    for (let i = 0; i < sequence.length - 1 - 1; i++) {
      result += '  '
    }
    result += '-'
  } else {
    for (let i = 0; i < sequence.length; i++) {
      result += sign
    }

    result += ' ' + sequence.join('.') + "、"
  }

  return result
}


function entry() {
  let inputDir = findOption('-i'); // Assuming the user specifies a directory with -d option
  let outputDir = findOption('-o'); // Assuming the user specifies an output directory with -o option

  if (!fs.existsSync(inputDir)) {
    console.error(`未找到${inputDir}目录`);
    return;
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const extractToPath = 'extracted/';
  if (fs.existsSync(extractToPath)) {
      fs.rmSync(extractToPath, { force: true, recursive: true });
    }

  let files = fs.readdirSync(inputDir);
  for (let file of files) {
    let filepath = path.join(inputDir, file);
    if (path.extname(filepath) === '.xmind') {
        let filename = file.replace(".xmind", "");
        unzip(filepath, extractToPath);
        toMarkdown(filename, extractToPath, outputDir);
        let outputFilePath = path.join(outputDir, `${filename}.md`);
        fs.renameSync(`${filename}.md`, outputFilePath);
        fs.rmSync(extractToPath, { force: true, recursive: true });
    }
  }
}

function findOption(option) {
  let args = process.argv
  const i = args.findIndex((value, _index, _arr) => option === value)
  if (i > args.length - 2) {
    console.err("usage: node xmind.cjs -i inputDir -o outputDir");
    return
  }
  return args[i + 1]
}

entry()
