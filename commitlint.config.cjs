module.exports = {
  extends: ['@commitlint/config-conventional'],
  // Dependabot's bodies (release notes, changelogs) break the line length rules
  ignores: [(message) => message.includes('Signed-off-by: dependabot[bot]')],
};
