For more detailed documentation please visit [docs.kyso.io](https://docs.kyso.io/posting-to-kyso/kyso-cli/installation)

# Installation
## NPM and YARN
The Kyso CLI could be installed as a NPM or YARN global package easily, just launching the next commands

```
npm install -g kyso
​```

or

```​
yarn global add kyso
```

Depending on your local configuration, maybe you will need to use **sudo or launch windows' terminal with administrative rights**

Once installed, check that it's available executing the next command

```
kyso
Kyso Client
​
VERSION
  kyso/1.0.0 linux-x64 node-v16.13.2
​
USAGE
  $ kyso [COMMAND]
​
TOPICS
  plugins  List installed plugins.
​
COMMANDS
  help                      Display help for kyso-cli.
  import-github-repository  Import Github repository to Kyso
  import-repository         Import repository to Kyso
  kyso-command
  login                     Make login request to the server
  open                      Open a report in the browser
  plugins                   List installed plugins.
  pull                      Pull repository from Kyso
  push                      Upload local repository to Kyso
```

## NPX
Since npm version 5.2.0 you can use npx instead of npm global install. The difference between npm and npx is that npx don't install anything globally in your computer, just download the dependency, execute it and then delete it, keeping your local node_modules smaller.
To use NPX just execute the next command

```
npx kyso
Need to install the following packages:
  kyso
Ok to proceed? (y) y
Kyso Client
​
VERSION
  kyso/0.0.7 darwin-x64 node-v16.13.2
​
USAGE
  $ kyso [COMMAND]
​
TOPICS
  hello    Say hello to the world and others
  plugins  List installed plugins.
​
COMMANDS
  hello                     Say hello
  help                      Display help for kyso-cli.
  import-github-repository  Import Github repository to Kyso
  kyso-command
  login                     Make login request to the server
  plugins                   List installed plugins.
  pull                      Pull repository from Kyso
  push                      Upload local repository to Kyso
```

# Configuration

Kyso can run in SaaS mode, at , but can run as well as On Premise with his own domain.

For that reason, Kyso CLI can point to multiple instances of Kyso, and before start to use Kyso CLI we should define to which instance we want to point.

## Linux and MacOS

### Using zsh terminal

Open a ZSH terminal and edit the file **~/.zshrc** to add the following environment variable

```
export KYSO_API=https://kyso.io/api/v1
```

Check that it's effectively added executing:

```
cat ~/.zshrc
export KYSO_API=https://kyso.io/api/v1
```

Close your terminal and open it again (as your current instance of the terminal is not updated until you restart it), and then execute the following command to check that the result is the same as follows

```
echo $KYSO_API
https://kyso.io/api/v1
```

Now all the operations of Kyso CLI will affect to the defined instance

> Remember that you can change the value of KYSO_API to your On Premise instance of Kyso

### Using bash terminal

Repeat the same steps than for zsh terminal, but editing the file **~/.bashrc** instead
