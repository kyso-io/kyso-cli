import { NormalizedResponseDTO, Organization, ResourcePermissions, Team, TeamPermissionsEnum, TeamVisibilityEnum, TokenPermissions } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import jwtDecode from 'jwt-decode';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import { KysoCredentials } from '../../types/kyso-credentials';
import { KysoCommand } from '../kyso-command';
import inquirer = require('inquirer');

export default class AddChannel extends KysoCommand {
  static description =
    'Add the channels on the list_of_channels to the given organization. This command asks interactively for the minimum data required to create each organization and later the user can update the information using the frontend or the get and set subcommands.';

  static examples = [`$ kyso channel add <organization> <list_of_channels>`];

  static args = [
    {
      name: 'organization',
      required: true,
      description: 'Organization name',
    },
    {
      name: 'list_of_channels',
      description: 'List of channels separated by commas',
      required: true,
    },
  ];

  private async createChannel(api: Api, organization: Organization, userId: string, channelDisplayName?: string): Promise<void> {
    const createTeam: Team = new Team(channelDisplayName, '', '', '', '', [], organization.id, TeamVisibilityEnum.PUBLIC, userId);
    if (!createTeam.display_name) {
      const displayNameResponse: { displayName: string } = await inquirer.prompt([
        {
          type: 'input',
          name: 'displayName',
          message: 'What is the name of the channel?',
          validate: function (displayName: string) {
            if (displayName === '') {
              return 'Name cannot be empty';
            }
            return true;
          },
        },
      ]);
      createTeam.display_name = displayNameResponse.displayName;
    }
    const teamVisibilityResponse: { teamVisibility: TeamVisibilityEnum } = await inquirer.prompt([
      {
        type: 'list',
        name: 'teamVisibility',
        message: `What is the visibility of the channel '${createTeam.display_name}'?`,
        choices: [
          {
            name: 'Private: Only invited members of this channel have access to this channels content.',
            value: TeamVisibilityEnum.PRIVATE,
          },
          {
            name: `Organization only: All members of the organization ${organization.display_name} can access this channel`,
            value: TeamVisibilityEnum.PROTECTED,
          },
          {
            name: 'Public: Everyone can see this channel. Reports in this channel can be viewed by anyone with the reports url.',
            value: TeamVisibilityEnum.PUBLIC,
          },
        ],
      },
    ]);
    createTeam.visibility = teamVisibilityResponse.teamVisibility;
    const bioResponse: { bio: string } = await inquirer.prompt([
      {
        type: 'input',
        name: 'bio',
        message: `What is the description of the channel '${createTeam.display_name}'?`,
      },
    ]);
    createTeam.bio = bioResponse.bio;
    try {
      api.setOrganizationSlug(organization.sluglified_name);
      const result: NormalizedResponseDTO<Team> = await api.createTeam(createTeam);
      const team: Team = result.data;
      const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
      this.log(`\nChannel '${team.display_name}' created. Visit its page ${kysoCredentials.kysoInstallUrl}/${organization.sluglified_name}/${team.sluglified_name}\n`);
    } catch (e: any) {
      this.log(`Error creating the channel '${createTeam.display_name}': ${e.response.data.message}`);
    }
  }

  async run(): Promise<void> {
    const { args } = await this.parse(AddChannel);
    const channelsNames: string[] = args.list_of_channels.split(',');
    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    const api: Api = new Api();
    api.configure(kysoCredentials.kysoInstallUrl + '/api/v1', kysoCredentials?.token);
    const decoded: { payload: any } = jwtDecode(kysoCredentials.token);
    let tokenPermissions: TokenPermissions | null = null;
    try {
      const resultPermissions: NormalizedResponseDTO<TokenPermissions> = await api.getUserPermissions(decoded.payload.username);
      tokenPermissions = resultPermissions.data;
    } catch (e) {
      this.error('Error getting user permissions');
    }
    const indexOrganization: number = tokenPermissions.organizations.findIndex((resourcePermissionOrganization: ResourcePermissions) => resourcePermissionOrganization.name === args.organization);
    if (indexOrganization === -1) {
      this.error(`You don't have permissions to create channels the organization ${args.organization}`);
    }
    const organizationResourcePermissions: ResourcePermissions = tokenPermissions.organizations[indexOrganization];
    const indexPermissionCreateChannel: number = organizationResourcePermissions.permissions.findIndex((permission: string) => permission === TeamPermissionsEnum.CREATE);
    if (indexPermissionCreateChannel === -1) {
      this.error(`You don't have permissions to create channels for the organization ${args.organization}`);
    }
    let organization: Organization | null = null;
    try {
      const resultOrganization: NormalizedResponseDTO<Organization> = await api.getOrganizationBySlug(args.organization);
      organization = resultOrganization.data;
    } catch (e) {
      this.error(`Error getting the organization ${args.organization}`);
    }
    for (const channelDisplayName of channelsNames) {
      await this.createChannel(api, organization, decoded.payload.id, channelDisplayName);
    }
  }
}
