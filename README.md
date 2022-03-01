oclif-hello-world
=================

oclif example Hello World CLI

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/oclif-hello-world.svg)](https://npmjs.org/package/oclif-hello-world)
[![CircleCI](https://circleci.com/gh/oclif/hello-world/tree/main.svg?style=shield)](https://circleci.com/gh/oclif/hello-world/tree/main)
[![Downloads/week](https://img.shields.io/npm/dw/oclif-hello-world.svg)](https://npmjs.org/package/oclif-hello-world)
[![License](https://img.shields.io/npm/l/oclif-hello-world.svg)](https://github.com/oclif/hello-world/blob/main/package.json)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g @kyso-io/kyso-cli
$ kyso-cli COMMAND
running command...
$ kyso-cli (--version)
@kyso-io/kyso-cli/0.0.7 darwin-x64 node-v16.13.0
$ kyso-cli --help [COMMAND]
USAGE
  $ kyso-cli COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`kyso-cli hello PERSON`](#kyso-cli-hello-person)
* [`kyso-cli hello world`](#kyso-cli-hello-world)
* [`kyso-cli help [COMMAND]`](#kyso-cli-help-command)
* [`kyso-cli import-github-repository`](#kyso-cli-import-github-repository)
* [`kyso-cli kyso-command`](#kyso-cli-kyso-command)
* [`kyso-cli login`](#kyso-cli-login)
* [`kyso-cli plugins`](#kyso-cli-plugins)
* [`kyso-cli plugins:inspect PLUGIN...`](#kyso-cli-pluginsinspect-plugin)
* [`kyso-cli plugins:install PLUGIN...`](#kyso-cli-pluginsinstall-plugin)
* [`kyso-cli plugins:link PLUGIN`](#kyso-cli-pluginslink-plugin)
* [`kyso-cli plugins:uninstall PLUGIN...`](#kyso-cli-pluginsuninstall-plugin)
* [`kyso-cli plugins update`](#kyso-cli-plugins-update)
* [`kyso-cli pull`](#kyso-cli-pull)
* [`kyso-cli push`](#kyso-cli-push)

## `kyso-cli hello PERSON`

Say hello

```
USAGE
  $ kyso-cli hello [PERSON] -f <value>

ARGUMENTS
  PERSON  Person to say hello to

FLAGS
  -f, --from=<value>  (required) Whom is saying hello

DESCRIPTION
  Say hello

EXAMPLES
  $ oex hello friend --from oclif
  hello friend from oclif! (./src/commands/hello/index.ts)
```

## `kyso-cli hello world`

Say hello world

```
USAGE
  $ kyso-cli hello world

DESCRIPTION
  Say hello world

EXAMPLES
  $ oex hello world
  hello world! (./src/commands/hello/world.ts)
```

## `kyso-cli help [COMMAND]`

Display help for kyso-cli.

```
USAGE
  $ kyso-cli help [COMMAND] [-n]

ARGUMENTS
  COMMAND  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for kyso-cli.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v5.1.10/src/commands/help.ts)_

## `kyso-cli import-github-repository`

Import Github repository to Kyso

```
USAGE
  $ kyso-cli import-github-repository -n <value>

FLAGS
  -n, --name=<value>  (required) name

DESCRIPTION
  Import Github repository to Kyso

EXAMPLES
  $ kyso import-github-repository --name <repository name>
```

## `kyso-cli kyso-command`

```
USAGE
  $ kyso-cli kyso-command
```

## `kyso-cli login`

Make login request to the server

```
USAGE
  $ kyso-cli login -u <value> -p <value> -r <value> [-o <value>] [-t <value>]

FLAGS
  -o, --organization=<value>  organization
  -p, --password=<value>      (required) password
  -r, --provider=<value>      (required) provider
  -t, --team=<value>          team
  -u, --username=<value>      (required) username

DESCRIPTION
  Make login request to the server

EXAMPLES
  $ kyso login --username <username> --password <password> --provider <provider> --organization <organization name> --team <team name>
      Logged successfully
```

## `kyso-cli plugins`

List installed plugins.

```
USAGE
  $ kyso-cli plugins [--core]

FLAGS
  --core  Show core plugins.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ kyso-cli plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.0.11/src/commands/plugins/index.ts)_

## `kyso-cli plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ kyso-cli plugins:inspect PLUGIN...

ARGUMENTS
  PLUGIN  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ kyso-cli plugins:inspect myplugin
```

## `kyso-cli plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ kyso-cli plugins:install PLUGIN...

ARGUMENTS
  PLUGIN  Plugin to install.

FLAGS
  -f, --force    Run yarn install with force flag.
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Installs a plugin into the CLI.

  Can be installed from npm or a git url.

  Installation of a user-installed plugin will override a core plugin.

  e.g. If you have a core plugin that has a 'hello' command, installing a user-installed plugin with a 'hello' command
  will override the core plugin implementation. This is useful if a user needs to update core plugin functionality in
  the CLI without the need to patch and update the whole CLI.

ALIASES
  $ kyso-cli plugins add

EXAMPLES
  $ kyso-cli plugins:install myplugin 

  $ kyso-cli plugins:install https://github.com/someuser/someplugin

  $ kyso-cli plugins:install someuser/someplugin
```

## `kyso-cli plugins:link PLUGIN`

Links a plugin into the CLI for development.

```
USAGE
  $ kyso-cli plugins:link PLUGIN

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Links a plugin into the CLI for development.

  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.

EXAMPLES
  $ kyso-cli plugins:link myplugin
```

## `kyso-cli plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ kyso-cli plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ kyso-cli plugins unlink
  $ kyso-cli plugins remove
```

## `kyso-cli plugins update`

Update installed plugins.

```
USAGE
  $ kyso-cli plugins update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

## `kyso-cli pull`

Pull repository from Kyso

```
USAGE
  $ kyso-cli pull [-p <value>]

FLAGS
  -p, --path=<value>  [default: .] path

DESCRIPTION
  Pull repository from Kyso

EXAMPLES
  $ kyso pull --path <name>
```

## `kyso-cli push`

Upload local repository to Kyso

```
USAGE
  $ kyso-cli push -p <value>

FLAGS
  -p, --path=<value>  (required) path

DESCRIPTION
  Upload local repository to Kyso

EXAMPLES
  $ kyso push --path <name>
```
<!-- commandsstop -->