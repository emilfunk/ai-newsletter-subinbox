# Read your brief in Outlook or Apple Mail

A Google account with Gmail does the processing. Your Outlook or iCloud address can receive the finished brief. You do not need to switch your everyday email app.

**Forward only newsletters, not your whole mailbox.** Forwarded newsletter text is sent to Google's Gemini API. Avoid confidential or personal messages. Free-tier prompts and replies may be used to improve Google's products; see the [Gemini terms](https://ai.google.dev/gemini-api/terms).

## Before forwarding

1. If needed, [create a free Google account with Gmail](https://accounts.google.com/signup). A Google account without Gmail is not sufficient.
2. Follow the [three-step setup](../README.md#setup-in-three-steps) while signed in to that Google account.
3. In the wizard, choose **External email**, enter your Outlook or iCloud address, and activate. Check that the sample briefing arrives there.
4. In Gmail, create a filter for the newsletter senders you will forward and choose **Apply the label → Subinbox/Newsletters**. Select **Skip the Inbox** if wanted. The downloadable broad newsletter filter is an alternative, but may miss forwarded mail or match unrelated messages.

The forwarding rule alone does not label mail in Gmail. Test the complete route with one newsletter before adding more senders.

## Outlook.com / Outlook on the web

1. Open Outlook in your browser. Select **Settings → Mail → Rules → Add new rule**. Names may differ slightly by account.
2. Name the rule “Newsletters to Subinbox”. Add a **From** condition for a newsletter sender. Do not create an unrestricted rule for all messages.
3. Under **Add an action**, choose **Forward to** and enter the processing Gmail address. Save.
4. Send or wait for one matching newsletter. In Gmail, confirm it appears under **Subinbox/Newsletters**. Open the forwarded message and check the sender Gmail actually sees; adjust your Gmail filter if Outlook replaced the original sender with your own address.

If a work/school account blocks external auto-forwarding, ask your administrator or change your newsletter subscriptions to deliver directly to the processing Gmail address. Do not bypass your organization's policy.

[Microsoft: inbox rules in Outlook](https://support.microsoft.com/en-us/office/use-inbox-rules-in-outlook-8400435c-f14e-4272-9004-1548bb1848f2)

## iCloud Mail / Apple Mail

Apple Mail is an app; the account behind it determines where forwarding runs. For an iCloud address, use a server-side iCloud rule so your Mac does not have to stay awake:

1. Open [iCloud Mail](https://www.icloud.com/mail/) in your browser.
2. Open **Settings → Rules → Add a Rule**.
3. Choose messages **from** a newsletter sender. Choose **Forward to** and enter the processing Gmail address. Save.
4. Wait for one newsletter and confirm it reaches Gmail with the **Subinbox/Newsletters** label. Adjust the Gmail filter to the forwarded sender/subject if necessary.

[Apple: set up iCloud Mail rules](https://support.apple.com/guide/icloud/set-up-filtering-rules-mm6b1a3f8a/icloud)

If Apple Mail reads a Gmail account, use Gmail filters directly: no forwarding is needed. For other providers, use their webmail rules. Local Apple Mail rules require the Mac and Mail app to stay running, so they are not a zero-maintenance option.

## Avoid forwarding loops

- Match specific newsletter senders, never all mail.
- Exclude mail from **AI Newsletter Subinbox**, subjects beginning **Morning Brief:**, and **[Sample]** briefings from forwarding rules.
- Do not subscribe the processing account to its own briefings or label incoming briefs as newsletters.
- Only the labeled, last-24-hours messages in the processing Gmail account are candidates for the daily brief. Sending a test digest uses fictional text; it does not test forwarding or process actual newsletters.

## If nothing arrives

- Check Spam/Junk on both accounts.
- Confirm the forwarded message is under the exact Gmail label **Subinbox/Newsletters** and arrived within the last 24 hours.
- Check the wizard's schedule timezone; delivery occurs within the selected hour, not at an exact minute.
- Check **Apps Script → Executions** for trigger errors or expired authorization. Gmail and Gemini each impose quotas.
- To stop forwarding, disable the Outlook/iCloud rule. To stop briefing generation, remove this script's two triggers as explained in the README.
