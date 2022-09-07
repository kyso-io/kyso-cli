import { User } from '@kyso-io/kyso-model'
import jwtDecode from 'jwt-decode'
import { KysoCredentials } from '../types/kyso-credentials'
import { KysoCommand } from './kyso-command'

export default class Push extends KysoCommand {
  static description = 'Current logged user and platform'

  static examples = [`$ kyso whoami`]

  async run(): Promise<void> {
    const kysoCredentials: KysoCredentials | null = KysoCommand.getCredentials()
    if (kysoCredentials) {
      const decoded: { payload: any; iat: number; exp: number } = jwtDecode(kysoCredentials.token)
      const user: User = decoded.payload
      this.log(`You are logged into ${kysoCredentials.kysoInstallUrl} as ${user.email}.`);
    } else {
      this.log(`No credentials found. Please login.`)
    }
    this.log(`Your kyso data directory is ${KysoCommand.DATA_DIRECTORY}`);
  }
}
