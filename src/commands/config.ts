import { Flags } from '@oclif/core'
import inquirer from 'inquirer'
import { KysoCredentials } from '../types/kyso-credentials'
import { KysoCommand } from './kyso-command'

export default class Config extends KysoCommand {
  static description = 'Login into Kyso'

  static examples = [
    `# Direct login using kyso provider and password
    $ kyso config --kysoInstallUrl <kyso_installation_url>`,
  ]

  static flags = {
    kysoInstallUrl: Flags.string({
      char: 'y',
      description: 'Url of your Kyso installation',
      required: false,
      multiple: false,
    }),
  }

  static args = []

  async run(): Promise<void> {
    const { flags } = await this.parse(Config)

    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials()
    let fixedKysoInstallUrl: string
    if (flags.kysoInstallUrl) {
      fixedKysoInstallUrl = flags.kysoInstallUrl
    } else {
      const kysoApiResponse: { kysoInstallUrl: string } = await inquirer.prompt([
        {
          name: 'kysoInstallUrl',
          message: 'What is the url of your kyso installation?',
          type: 'input',
          default: kysoCredentials?.fixedKysoInstallUrl || kysoCredentials?.kysoInstallUrl,
          validate: function (password: string) {
            if (password === '') {
              return 'Url cannot be empty'
            }
            return true
          },
          filter: (input: string) => {
            if (input.endsWith('/')) {
              input = input.slice(0, -1)
            }
            return input.trim()
          },
        },
      ])
      fixedKysoInstallUrl = kysoApiResponse.kysoInstallUrl
    }
    KysoCommand.saveToken(kysoCredentials.token, kysoCredentials.organization, kysoCredentials.team, kysoCredentials.kysoInstallUrl, kysoCredentials.username, fixedKysoInstallUrl)
  }
}
