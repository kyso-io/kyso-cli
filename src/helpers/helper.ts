import { Api } from '@kyso-io/kyso-store';
import { OrganizationPermissionsEnum, GlobalPermissionsEnum, TokenPermissions, KysoConfigFile, NormalizedResponseDTO, Organization, Team, ResourcePermissions } from '@kyso-io/kyso-model';
import { KysoCredentials } from '../types/kyso-credentials';
import { KysoCommand } from '../commands/kyso-command';
import { existsSync, lstatSync, statSync, readdirSync, readFileSync } from 'fs';
import ignore from 'ignore';
import { join } from 'path';
import sha256File from 'sha256-file';
import slugify from 'slugify';
export class Helper {
  public static async getOrganizationFromSlugSecurely(organizationParameter: string, credentials: KysoCredentials): Promise<NormalizedResponseDTO<Organization>> {
    // Slug the organization to ensure that if someone introduced the name of the organization in
    // capital letters we are going to be able to answer properly
    const slugifiedOrganization = Helper.slug(organizationParameter);

    let result: NormalizedResponseDTO<Organization>;
    try {
      const api: Api = new Api();
      api.configure(credentials.kysoInstallUrl + '/api/v1', credentials?.token);
      result = await api.getOrganizationBySlug(slugifiedOrganization);
    } catch (e) {
      console.log(`Can't retrieve organization ${organizationParameter}`);
      if (organizationParameter !== slugifiedOrganization) {
        console.log(`Detected a non-slug value, automatically slugified to ${slugifiedOrganization}`);
      }
      console.log('Please check that the name (or slug) of the organization is correct');
      throw new Error('Please check that the name (or slug) of the organization is correct');
    }

    return result;
  }

  public static async getChannelFromSlugSecurely(organization: Organization, channelParameter: string, credentials: KysoCredentials, silent?: boolean): Promise<NormalizedResponseDTO<Team>> {
    // Slug the organization to ensure that if someone introduced the name of the organization in
    // capital letters we are going to be able to answer properly
    const slugifiedChannel = Helper.slug(channelParameter);

    let result: NormalizedResponseDTO<Team>;
    try {
      const api: Api = new Api();
      api.configure(credentials.kysoInstallUrl + '/api/v1', credentials?.token, organization.sluglified_name);
      result = await api.getTeamBySlug(organization.id, slugifiedChannel);
    } catch (e) {
      if (!silent) {
        console.log(`Can't retrieve channel ${channelParameter} from organization ${organization.display_name}`);

        if (channelParameter !== slugifiedChannel) {
          console.log(`Detected a non-slug value, automatically slugified to ${slugifiedChannel}`);
        }
        console.log('Please check that the name (or slug) of the channel is correct');
      }
      throw new Error('Please check that the name (or slug) of the channel is correct');
    }

    return result;
  }

  /**
   * Receives an array of organizations (name or slugs, or intercalated)
   *
   * Checks that every organization exists and extracts its slug name
   *
   * Returns an array of checked slug names. If some of these organizations are not valid
   * or don't exists, throws an exception
   *
   * @param list_of_orgs List of orgs (names or slugs) separated by commas
   * @returns Ensured list of slugified names.
   */
  public static async getRealOrganizationSlugFromStringArray(list_of_orgs: string, credentials: KysoCredentials): Promise<string[]> {
    // Slug the organization to ensure that if someone introduced the name of the organization in
    // capital letters we are going to be able to answer properly
    const organizationList: string[] = list_of_orgs.split(',');
    const organizationSlugs: string[] = [];

    for (const org of organizationList) {
      const secureOrg: NormalizedResponseDTO<Organization> = await Helper.getOrganizationFromSlugSecurely(org, credentials);
      organizationSlugs.push(secureOrg.data.sluglified_name);
    }

    return organizationSlugs;
  }

  /**
   * Receives an array of channels (name or slugs, or intercalated)
   *
   * Checks that every channel exists and extracts its slug name
   *
   * Returns an array of checked slug names. If some of these channels are not valid
   * or don't exists, throws an exception
   *
   * @param organization Organization in which channels must be subscribed
   * @param list_of_channels List of channels (names or slugs) separated by commas
   * @returns Ensured list of slugified names.
   */
  public static async getRealChannelsSlugFromStringArray(organization: Organization, list_of_channels: string, credentials: KysoCredentials): Promise<string[]> {
    // Slug the organization to ensure that if someone introduced the name of the organization in
    // capital letters we are going to be able to answer properly
    const channelsList: string[] = list_of_channels.split(',');
    const channelsSlug: string[] = [];

    for (const channel of channelsList) {
      const secureChannel: NormalizedResponseDTO<Team> = await Helper.getChannelFromSlugSecurely(organization, channel, credentials);
      channelsSlug.push(secureChannel.data.sluglified_name);
    }

    return channelsSlug;
  }

  public static findKysoConfigFile(files: string[]): { kysoConfigFile: KysoConfigFile | null; kysoConfigPath: string | null; valid: boolean; message: string | null } {
    let data: {
      valid: boolean;
      message: string | null;
      kysoConfigFile: KysoConfigFile | null;
    } = {
      valid: false,
      message: null,
      kysoConfigFile: null,
    };
    let index: number = files.findIndex((file: string) => file.endsWith('kyso.json'));
    if (index > -1) {
      try {
        data = KysoConfigFile.fromJSON(readFileSync(files[index], 'utf8').toString());
      } catch (error: any) {
        throw new Error(`Error parsing kyso.json: ${error.message}`);
      }
    } else {
      index = files.findIndex((file: string) => file.endsWith('kyso.yml') || file.endsWith('kyso.yaml'));
      if (index > -1) {
        try {
          data = KysoConfigFile.fromYaml(readFileSync(files[index], 'utf8'));
        } catch (error: any) {
          throw new Error(`Error parsing kyso.yml: ${error.message}`);
        }
      }
    }

    let kysoConfigPath: string | null = null;
    if (index === -1) {
      data.message = 'No kyso config file found.';
    } else {
      kysoConfigPath = files[index];
    }

    // To allow the possibility to rename team to channel
    if (data?.kysoConfigFile && data.kysoConfigFile.channel && !data.kysoConfigFile.team) {
      data.kysoConfigFile.team = data.kysoConfigFile.channel;
    }

    return { kysoConfigFile: data.kysoConfigFile, kysoConfigPath, valid: data.valid, message: data.message };
  }

  public static isEmail(email: string): boolean {
    if (!email) {
      return false;
    }
    const emailRegex = new RegExp('^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:.[a-zA-Z0-9-]+)*$');
    return emailRegex.test(email);
  }

  public static isImage(name: string) {
    return name != null && (name.toLowerCase().endsWith('.png') || name.toLowerCase().endsWith('.jpg') || name.toLowerCase().endsWith('.jpeg') || name.toLowerCase().endsWith('.gif'));
  }

  public static printErrorMessage(ex: any) {
    if (ex.hasOwnProperty('response')) {
      // It's an HTTP exception
      if (ex.response) {
        switch (ex.response.status) {
          case 401: {
            console.log("\nAuthorization failed. Please run 'kyso login' again\n");
            break;
          }
          case 403: {
            console.log("\n⛔ You don't have enough permissions to perform this action\n");
            break;
          }
          case 400: {
            console.log('\nBad request. Check the provided data.\n');
            break;
          }
          default: {
            console.log(`\n${ex.response.statusText}`);
            break;
          }
        }
      } else {
        // If response is null the object is different
        if (ex.message.includes('getaddrinfo ENOTFOUND')) {
          console.log(`\n${KysoCommand.getCredentials().kysoInstallUrl} is not reachable. Please check your internet connection and ensure that your Kyso instance is available\n`);
        } else {
          // We don't know the message, so just print it
          console.log(`\n${ex.message}`);
        }
      }
    } else {
      // It's a common node exception
      if (ex.hasOwnProperty('message')) {
        if (ex.message.includes('ENOENT: no such file or directory')) {
          console.log(`\nThe specified directory does not exist. Please create it before launching kyso\n`);
          console.log(ex.message);
        } else {
          // We don't know the message, so just print it
          console.log(`\n${ex.message}`);
        }
      } else {
        console.log(`Unexpected error`);
      }
    }
  }

  public static getAllFiles(dirPath: string, arrayOfFiles: string[]): string[] {
    const files: string[] = readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];
    for (const file of files) {
      if (file.startsWith('.') || file.endsWith('__MACOSX')) {
        continue;
      }
      if (!existsSync(dirPath + '/' + file)) {
        continue;
      }
      if (statSync(dirPath + '/' + file).isDirectory()) {
        arrayOfFiles = Helper.getAllFiles(dirPath + '/' + file, arrayOfFiles);
      } else {
        arrayOfFiles.push(join(dirPath, '/', file));
      }
    }
    return arrayOfFiles;
  }

  public static getValidFiles(dirPath: string): { path: string; sha: string }[] {
    if (!existsSync(dirPath)) {
      throw new Error(`Folder ${dirPath} not found`);
    }
    const files: string[] = readdirSync(dirPath);
    const filesToIgnore: string[] = ['.git', '.DS_Store'];
    for (const file of files) {
      if (file === '.gitignore' || file === '.kysoignore') {
        // Read content of file
        const content: string = readFileSync(join(dirPath, file), 'utf8').toString();
        // Split content into lines
        const lines: string[] = content.split('\n');
        // Remove empty lines
        const filteredLines: string[] = lines.filter((line) => line.length > 0);
        // Add lines to ignored files if line is not in list
        for (const line of filteredLines) {
          // Check duplicates
          if (!filesToIgnore.includes(line)) {
            filesToIgnore.push(line);
          }
        }
      }
    }
    const ig = ignore().add(filesToIgnore);
    // Remove ignored files defined in .gitignore or .kysoignore
    const filteredFiles: string[] = files.filter((file) => !ig.ignores(file));
    let validFiles: { path: string; sha: string }[] = [];
    for (const file of filteredFiles) {
      // For each file
      const filePath: string = join(dirPath, file);
      // check if it is a directory
      if (lstatSync(filePath).isDirectory()) {
        // Recursive call
        const folderFiles: { path: string; sha: string }[] = Helper.getValidFiles(filePath);
        validFiles = [...validFiles, ...folderFiles];
      } else {
        // Add to the valid files
        validFiles.push({
          path: filePath,
          sha: sha256File(filePath),
        });
      }
    }
    return validFiles;
  }

  public static slug(url: string): string {
    return slugify(url, {
      replacement: '-',
      lower: true,
      strict: true,
      trim: true,
    });
  }

  public static isOrganizationAdmin(resourcePermissions: ResourcePermissions): boolean {
    if (!resourcePermissions) {
      return false;
    }

    if (!resourcePermissions.permissions || !Array.isArray(resourcePermissions.permissions)) {
      return false;
    }

    return resourcePermissions.permissions.includes(OrganizationPermissionsEnum.ADMIN);
  }

  public static isGlobalAdmin(tokenPermissions: TokenPermissions): boolean {
    if (!tokenPermissions) {
      return false;
    }

    if (!tokenPermissions.global || !Array.isArray(tokenPermissions.global)) {
      return false;
    }

    return tokenPermissions.global.includes(GlobalPermissionsEnum.GLOBAL_ADMIN);
  }

  public static hasPermission(resourcePermissions: ResourcePermissions, permission: any): boolean {
    if (!resourcePermissions) {
      return false;
    }

    if (!resourcePermissions.permissions || !Array.isArray(resourcePermissions.permissions)) {
      return false;
    }

    return resourcePermissions.permissions.includes(permission);
  }
}
