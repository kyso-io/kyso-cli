import { GlobalPermissionsEnum, NormalizedResponseDTO, OrganizationPermissionsEnum, ResourcePermissions, TokenPermissions } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import { Flags } from '@oclif/core';
import jwtDecode from 'jwt-decode';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import { KysoCredentials } from '../../types/kyso-credentials';
import { KysoCommand } from '../kyso-command';
import inquirer = require('inquirer');

export default class DeleteOrganization extends KysoCommand {
  static description = 'Delete organization from the system';

  static examples = [`$ kyso organization del`, `$ kyso organization del <org_name>`, `$ kyso organization del -l <list_of_orgs>`, `$ kyso organization del <org_name> -l <list_of_orgs>`];

  static flags = {
    listOfOrgs: Flags.string({
      char: 'l',
      description: 'List of organizations to delete',
      required: false,
      multiple: true,
    }),
  };

  static args = [
    {
      name: 'name',
    },
  ];

  private async deleteOrganization(api: Api, tokenPermissions: TokenPermissions, slugifiedName: string): Promise<void> {
    const indexOrganization: number = tokenPermissions.organizations.findIndex((resourcePermissionOrganization: ResourcePermissions) => resourcePermissionOrganization.name === slugifiedName);
    if (indexOrganization === -1) {
      this.log(`Error: You don't have permissions to delete the organization ${slugifiedName}`);
      return;
    }
    api.setOrganizationSlug(slugifiedName);
    const resourcePermissions: ResourcePermissions = tokenPermissions.organizations[indexOrganization];
    const hasPermissionDelete: boolean = resourcePermissions.permissions.includes(OrganizationPermissionsEnum.DELETE);
    const isAdmin: boolean = resourcePermissions.permissions.includes(OrganizationPermissionsEnum.ADMIN);
    const isGlobalAdmin: boolean = tokenPermissions.global.includes(GlobalPermissionsEnum.GLOBAL_ADMIN);
    if (!hasPermissionDelete && !isAdmin && !isGlobalAdmin) {
      this.log(`Error: You don't have permissions to delete the organization ${slugifiedName}`);
      return;
    }
    try {
      await api.deleteOrganization(resourcePermissions.id);
      this.log(`Organization ${slugifiedName} deleted`);
    } catch (e: any) {
      this.log(`Error deleting the organization ${slugifiedName}: ${e.response.data.message}`);
    }
  }

  async run(): Promise<void> {
    const { flags, args } = await this.parse(DeleteOrganization);
    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    const decoded: { payload: any } = jwtDecode(kysoCredentials.token);
    const api: Api = new Api();
    api.configure(kysoCredentials.kysoInstallUrl + '/api/v1', kysoCredentials?.token);
    const resultPermissions: NormalizedResponseDTO<TokenPermissions> = await api.getUserPermissions(decoded.payload.username);
    const tokenPermissions: TokenPermissions = resultPermissions.data;
    if (args.name) {
      await this.deleteOrganization(api, tokenPermissions, args.name);
    }
    if (flags.listOfOrgs) {
      for (const slugifiedName of flags.listOfOrgs) {
        await this.deleteOrganization(api, tokenPermissions, slugifiedName);
      }
    }
    if (!args.name && !flags.listOfOrgs) {
      const nameResponse: { name: string } = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'What is the name of the organization?',
          validate: function (name: string) {
            if (name === '') {
              return 'Name cannot be empty';
            }
            return true;
          },
        },
      ]);
      await this.deleteOrganization(api, tokenPermissions, nameResponse.name);
    }
  }
}
