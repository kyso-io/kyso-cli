import { KysoCommand } from './kyso-command'

export default class Logout extends KysoCommand {
  static description = 'Logout from Kyso'

  static examples = [`$ kyso logout`]

  static flags = {}

  static args = []

  async run(): Promise<void> {
    KysoCommand.removeCredentials()
    this.log('Logged out from Kyso')
  }
}
