# Security

Family Hub keeps a family's records - medical, money, children's - in their own browser and, if
they choose, their own Google Drive folder. Nothing is sent to Detronics or anyone else. If you
find a way that this could go wrong, please tell us privately.

## Reporting a problem

Use **GitHub's private vulnerability reporting**:
<https://github.com/detronics-apps/FamilyHub/security/advisories/new>

Please do not open a public issue for a security problem. Include what you did, what happened, and
which version (the number in the app's footer).

## What happens next

1. We reply within a few days to say it arrived, and whether we can reproduce it.
2. A fix is made on the `platform` branch, with a test that would have caught it.
3. It is published through a pull request into `main` once the tests are green and the diff has
   been read (see "How a change is published" in the README).
4. We tell you when it is live, and credit you in the advisory if you would like that.

## Withdrawing a bad version

- **Revert on `main`** (`git revert` the bad commit and push), or switch the site off entirely in
  the repository's **Settings › Pages › Unpublish**.
- Family Hub has **no service worker**, so nothing is cached beyond the browser's ordinary cache:
  the fix reaches everyone within about **10 minutes**.
- **Telling families:** a note in the app (the notice row under the header) and on the Detronics
  site, saying what happened, what to check, and that their data never left their browser or Drive.
- **If the GitHub account was involved:** rotate its credentials - password, passkeys or security
  keys, recovery codes - revoke every personal access token and SSH key, and review the
  repository's collaborators, deploy keys and Pages settings (custom domain) before publishing again.

## What is in scope

The app at <https://familyhub.detronics.co.za/>, this repository, and the mini-app sandbox
(`sandbox.html`, `js/ui/sandbox.js`, `js/ui/packages.js`). Google Drive and Google Drive for
Desktop are Google's; report problems with them to Google.
