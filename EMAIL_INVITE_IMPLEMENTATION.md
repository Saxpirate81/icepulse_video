# Email Invite Implementation Guide

## Current Status

**The email invite system is NOT fully implemented.** When you click "Send Invite", the system:

1. ✅ Updates the database to mark the invite as sent (`invite_sent = true`, `invite_date = now()`)
2. ✅ Shows a success confirmation message
3. ❌ **Does NOT actually send an email** - this is where it's failing

## Where to Find the Issue

The invite functions are located in `src/context/OrgContext.jsx`:

- `sendCoachInvite()` - Line ~675
- `sendPlayerInvite()` - Line ~922
- `sendParentInvite()` - Line ~1099

Each function has a `TODO` comment:
```javascript
// TODO: Replace with actual API call to send invite email
```

## Debugging

I've added detailed console logging to help you debug. When you click "Send Invite", check your browser console (F12 → Console tab). You should see:

```
[sendPlayerInvite] Starting invite process for playerId: <id>
[sendPlayerInvite] Player found: { id: ..., name: ..., email: ... }
[sendPlayerInvite] Updating database to mark invite as sent...
[sendPlayerInvite] Database updated successfully
[sendPlayerInvite] EMAIL SENDING NOT IMPLEMENTED - Would send email to: { to: ..., subject: ..., body: ... }
⚠️ Email sending is not yet implemented. The invite has been marked as sent in the database, but no actual email was sent.
```

## Implementation Options

### Option 1: Supabase Edge Functions (Recommended)

Create a Supabase Edge Function to handle email sending. This keeps your email logic server-side and secure.

1. **Create an Edge Function:**
   ```bash
   supabase functions new send-invite-email
   ```

2. **Install email service** (e.g., Resend, SendGrid, or use Supabase's built-in email):
   ```bash
   cd supabase/functions/send-invite-email
   npm install resend  # or your preferred email service
   ```

3. **Implement the function** to send emails using your email service API

4. **Call the function from your invite functions:**
   ```javascript
   const sendPlayerInvite = async (playerId) => {
     // ... existing validation code ...
     
     // Update database
     await updatePlayer(playerId, {
       inviteSent: true,
       inviteDate: new Date().toISOString()
     })
     
     // Call Edge Function to send email
     const { data, error } = await supabase.functions.invoke('send-invite-email', {
       body: {
         to: player.email,
         name: player.fullName,
         type: 'player',
         organizationName: organization?.name,
         inviteUrl: `${window.location.origin}/signup?email=${encodeURIComponent(player.email)}`
       }
     })
     
     if (error) {
       console.error('Failed to send invite email:', error)
       return { success: false, message: 'Failed to send email. Please try again.' }
     }
     
     return { success: true, message: 'Invite sent successfully' }
   }
   ```

### Option 2: Direct Email Service Integration

Use an email service directly from the frontend (less secure, but simpler):

1. **Install an email service SDK** (e.g., Resend):
   ```bash
   npm install resend
   ```

2. **Create an API key** in your email service dashboard

3. **Add to `.env` file:**
   ```env
   VITE_RESEND_API_KEY=your_api_key_here
   ```

4. **Update invite functions:**
   ```javascript
   import { Resend } from 'resend'
   
   const resend = new Resend(import.meta.env.VITE_RESEND_API_KEY)
   
   const sendPlayerInvite = async (playerId) => {
     // ... existing validation code ...
     
     // Update database
     await updatePlayer(playerId, {
       inviteSent: true,
       inviteDate: new Date().toISOString()
     })
     
     // Send email
     try {
       const { data, error } = await resend.emails.send({
         from: 'IcePulse <invites@yourdomain.com>',
         to: player.email,
         subject: `Invitation to join ${organization?.name}`,
         html: `
           <h1>You've been invited!</h1>
           <p>Hello ${player.fullName},</p>
           <p>You have been invited to join ${organization?.name} as a player.</p>
           <p><a href="${window.location.origin}/signup?email=${encodeURIComponent(player.email)}">Sign up now</a></p>
         `
       })
       
       if (error) {
         console.error('Email send error:', error)
         return { success: false, message: 'Failed to send email' }
       }
       
       console.log('Email sent successfully:', data)
       return { success: true, message: 'Invite sent successfully' }
     } catch (error) {
       console.error('Email sending failed:', error)
       return { success: false, message: 'Failed to send email' }
     }
   }
   ```

### Option 3: Supabase Built-in Email (Limited)

Supabase has limited built-in email functionality. You can use it for simple emails, but it's not recommended for production:

```javascript
// This requires Supabase Edge Functions or a custom backend
// Supabase doesn't provide direct email sending from the client
```

## Recommended Email Services

1. **Resend** - Modern, developer-friendly, great free tier
   - Website: https://resend.com
   - Free tier: 3,000 emails/month

2. **SendGrid** - Industry standard, robust features
   - Website: https://sendgrid.com
   - Free tier: 100 emails/day

3. **Mailgun** - Reliable, good for transactional emails
   - Website: https://mailgun.com
   - Free tier: 5,000 emails/month (first 3 months)

4. **AWS SES** - Cost-effective at scale
   - Website: https://aws.amazon.com/ses
   - Free tier: 62,000 emails/month (if on EC2)

## Testing Email Sending

After implementing email sending:

1. **Check console logs** - The detailed logging will show you exactly where the process is
2. **Test with a real email** - Use your own email address first
3. **Check spam folder** - Invite emails might go to spam initially
4. **Verify email service dashboard** - Most services have a dashboard showing sent emails
5. **Check email service logs** - Look for delivery status, bounces, etc.

## Next Steps

1. Choose an email service (Resend recommended for simplicity)
2. Set up an account and get an API key
3. Implement the email sending in the invite functions
4. Test with a real email address
5. Monitor email delivery and adjust as needed

## Security Notes

⚠️ **Important:** Never expose your email service API key in client-side code if using Option 2. For production, use:
- Supabase Edge Functions (Option 1) - API key stored server-side
- A custom backend API - API key stored server-side
- Environment variables that are NOT prefixed with `VITE_` (these are exposed to the client)

If you must use client-side email sending, use a restricted API key with minimal permissions and consider rate limiting.
