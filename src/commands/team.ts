import { Flags } from '@oclif/core'
import { fetchTeamAction, store } from '@kyso-io/kyso-store'
import { KysoCommand } from './kyso-command'

// export default class Login extends Command {
export default class Team extends KysoCommand {
  static description = 'Fetch team information'

  static examples = [`$ kyso-cli team --name development`]

  static flags = {
    teamName: Flags.string({
      char: 'n',
      description: 'team name',
      required: true,
    }),
  }

  static args = []

  async run(): Promise<void> {
    await this.checkCredentials()

    const { flags } = await this.parse(Team)
    await store.dispatch(fetchTeamAction(flags.teamName))

    const { team } = store.getState()
    if (team?.team) {
      this.log(JSON.stringify(team.team))
    } else {
      this.error('Team not found')
    }
  }
}
