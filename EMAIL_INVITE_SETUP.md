# Email Invite Setup Guide

## Current Status

The app now uses Supabase's `inviteUserByEmail()` function to send actual invite emails. However, you're currently using Supabase's built-in email service, which has rate limits.

## Built-in Email Service Limitations

- **Rate Limits**: Limited number of emails per hour/day
- **Not for Production**: Meant for development/testing only
- **May be Blocked**: Some email providers may mark these as spam

## For Testing (Current Setup)

The built-in service **should still work** for testing, but:
- You may hit rate limits if sending many invites
- Emails might go to spam folders
- There may be delays

## Setting Up Custom SMTP (Recommended for Production)

To send emails reliably, set up custom SMTP:

### Option 1: Use Supabase's SMTP Settings

1. Go to Supabase Dashboard → Authentication → Emails → **SMTP Settings** tab
2. Click **"Set up SMTP"** button
3. Choose a provider:
   - **SendGrid** (recommended, free tier available)
   - **Mailgun** (free tier available)
   - **AWS SES** (pay-as-you-go)
   - **Custom SMTP** (any SMTP server)

### Option 2: Use SendGrid (Free Tier)

1. Sign up at [SendGrid](https://sendgrid.com) (free tier: 100 emails/day)
2. Create an API key in SendGrid dashboard
3. In Supabase → Authentication → Emails → SMTP Settings:
   - **Host**: `smtp.sendgrid.net`
   - **Port**: `587`
   - **Username**: `apikey`
   - **Password**: Your SendGrid API key
   - **Sender email**: Your verified sender email
   - **Sender name**: Your organization name

### Option 3: Use Gmail SMTP (For Testing)

⚠️ **Not recommended for production** - Gmail has strict limits

1. Enable "Less secure app access" or use App Password
2. In Supabase SMTP Settings:
   - **Host**: `smtp.gmail.com`
   - **Port**: `587`
   - **Username**: Your Gmail address
   - **Password**: Gmail App Password (not your regular password)
   - **Sender email**: Your Gmail address

## Testing Invite Emails

After setting up SMTP (or using built-in service):

1. **Send an invite** from the app (Player/Coach/Parent management)
2. **Check the email inbox** (and spam folder)
3. **Click the invite link** in the email
4. **Set a password** to complete account setup
5. **Log in** with the new account

## Troubleshooting

### Emails Not Arriving

1. **Check spam folder** - Supabase emails often go to spam initially
2. **Check rate limits** - Built-in service has limits
3. **Verify SMTP settings** - If using custom SMTP, test the connection
4. **Check Supabase logs** - Dashboard → Logs → Auth Logs

### Rate Limit Errors

If you see rate limit errors:
- Wait 1 hour and try again (built-in service)
- Set up custom SMTP for higher limits
- Use SendGrid free tier (100 emails/day)

### Email Template Customization

1. Go to Supabase Dashboard → Authentication → Emails → **Templates** tab
2. Click on **"Invite user"** template
3. Customize the email subject and body
4. Use variables like `{{ .Email }}`, `{{ .ConfirmationURL }}`, etc.

## Current Implementation

The app now:
- ✅ Uses `inviteUserByEmail()` to send actual emails
- ✅ Creates user accounts when invite is sent
- ✅ Links player/coach/parent records to user accounts
- ✅ Marks invites as sent in database

## Next Steps

1. **For Testing**: Try sending an invite - it should work with built-in service (check spam)
2. **For Production**: Set up custom SMTP (SendGrid recommended)
3. **Monitor**: Check Supabase Auth logs to see if emails are being sent

## Verify Email Sending

Check Supabase Dashboard → Logs → Auth Logs to see:
- When invites are sent
- If emails are delivered
- Any errors that occur
