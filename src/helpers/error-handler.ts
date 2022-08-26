import { KysoCommand } from "../commands/kyso-command";

export const printErrorMessage = (ex: any) => {
  if(ex.hasOwnProperty('response')) {
    // It's an HTTP exception
    if(ex.response) {
      switch(ex.response.status) {
        case 401:
          console.log("\nAuthorization failed. Please run 'kyso login' again\n");
          break;
        case 403:
          console.log("\n⛔ You don't have enough permissions to perform this action\n");
          break;
        case 400:
          console.log("\nBad request. Check the provided data.\n");
          break;
        default:
          console.log(`\n${ex.response.statusText}`)
          break;
      }
    } else {
      // If response is null the object is different
      if(ex.message.includes("getaddrinfo ENOTFOUND")) {
        console.log(`\n${KysoCommand.getCredentials().kysoInstallUrl} is not reachable. Please check your internet connection and ensure that your Kyso instance is available\n`);
      } else {
        // We don't know the message, so just print it
        console.log(`\n${ex.message}`);
      }
    }
    
  } else {
    // It's a common node exception
    if(ex.hasOwnProperty("message")) {
      if(ex.message.includes("ENOENT: no such file or directory")) {
        console.log(`\nThe specified directory does not exist. Please create it before launching kyso\n`);
        console.log(ex.message);
      } else {
        // We don't know the message, so just print it
        console.log(`\n${ex.message}`);
      }
    }
  }
}
