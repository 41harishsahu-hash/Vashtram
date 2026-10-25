/**
 * VASHTRAM Admin Password Reset CLI Runner
 * Proxies to server/utils/resetAdminPassword.js
 */
const { runCli, resetAdminPassword } = require('../utils/resetAdminPassword');

if (require.main === module) {
  runCli();
}

module.exports = { resetAdminPassword, runCli };
