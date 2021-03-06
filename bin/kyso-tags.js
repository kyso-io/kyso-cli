#!/usr/bin/env node
const chalk = require('chalk')
const table = require('text-table')
const ms = require('ms')
const getCommandArgs = require('../src/command-args')
const strlen = require('../src/strlen')
const { error, handleError } = require('../src/error')
const Kyso = require('../src')
const exit = require('../src/utils/exit')

const help = async () => {
  console.log(
    `
  ${chalk.bold('kyso tags')} <ls | add | rm> <tagname>

  ${chalk.dim('Options:')}
    -h, --help              Output usage information
    -d, --debug             Debug mode [off]

  ${chalk.dim('Examples:')}

  ${chalk.gray('–')} List all tags in the current study:
      ${chalk.cyan('$ kyso tags ls')}

  ${chalk.gray('–')} Create a tag:
      ${chalk.cyan(`$ kyso tags add ${chalk.underline('my-tag-name')}`)}

  ${chalk.gray('–')} Remove a tag:
      ${chalk.cyan('$ kyso tags rm my-tag-name')}
`
  )
}

const ls = async (kyso, args) => {
  if (args.length !== 0) {
    error('Invalid number of arguments')
    return exit(1)
  }

  const start_ = new Date()
  const tagList = await kyso.lsTags()

  const header = [
    ['', 'tag'].map(s => chalk.dim(s))
  ]

  let out = null
  if (tagList.length !== 0) {
    out = table(header.concat(
        tagList.map(t => ['', t])
      ), {
        align: ['l', 'r'],
        hsep: ' '.repeat(2),
        stringLength: strlen
      }
    )
  }

  const elapsed_ = ms(new Date() - start_)
  console.log(`> ${tagList.length} tag${tagList.length === 1 ? '' : 's'} found ${chalk.gray(`[${elapsed_}]`)}`)
  if (out) { console.log(`\n${out}\n`) }
  return true
}

const rm = async (kyso, args) => {
  if (args.length !== 1) {
    error('Invalid number of arguments')
    return exit(1)
  }

  const _target = String(args[0])
  if (!_target) {
    const err = new Error('No tag specified')
    err.userError = true
    throw err
  }

  const tagList = await kyso.lsTags()
  const _tag = tagList.find(d => (d === _target))

  if (!_tag) {
    const err = new Error(
      `Tag not found. Run ${chalk.dim('`kyso tags ls`')} to see your tags.`
    )
    err.userError = true
    throw err
  }

  const start = new Date()
  await kyso.rmTag(_tag)
  const elapsed = ms(new Date() - start)
  console.log(
    `${chalk.cyan('> Success!')} Tag ${chalk.bold(_tag)} removed [${elapsed}]`
  )
  return true
}

const add = async (kyso, args) => {
  if (args.length !== 1) {
    error('Invalid number of arguments')
    return exit(1)
  }

  const start = new Date()
  const name = String(args[0])
  const tagMade = await kyso.addTag(name)
  const elapsed = ms(new Date() - start)

  if (tagMade) {
    console.log(`${chalk.cyan('> Success!')} Tag ${chalk.bold(chalk.underline(name))} added [${elapsed}]`)
  }
  return true
}


(async () => {
  try {
    const { args, argv, subcommand, token, apiUrl } = await getCommandArgs()

    if (argv.help || !subcommand) {
      help()
      return exit(0)
    }

    const kyso = new Kyso({
      url: apiUrl,
      token,
      debug: argv.debug,
      dir: process.cwd()
    })

    if (subcommand === 'ls' || subcommand === 'list') {
      return await ls(kyso, args)
    }

    if (subcommand === 'rm' || subcommand === 'remove') {
      return await rm(kyso, args)
    }

    if (subcommand === 'add') {
      return await add(kyso, args)
    }

    error('Please specify a valid subcommand: ls | add | rm | help')
    return help()
  } catch (err) {
    return handleError(err)
  }
})()
