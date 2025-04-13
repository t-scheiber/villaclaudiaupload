# Villa Claudia Document Upload System

A secure web application for Villa Claudia guests to upload travel documents (passports/IDs) before their stay.

## Features

- **Secure Document Upload**: Guests can safely upload passport/ID scans through a user-friendly interface
- **Automated Email Reminders**: System sends reminders 7 days before guest check-in
- **Direct Link Access**: Simple URL access - no account creation needed
- **Admin Dashboard**: View and manage all uploaded documents
- **Secure Storage**: Documents are stored securely and only accessible to authorized staff

## Scheduled Reminders

The system sends automatic email reminders to guests 7 days before their stay. To set up the scheduler:

1. Configure the WordPress connection in `.env`
2. Set up a cron job on your server to hit the scheduler endpoint daily:
   ```
   0 0 * * * curl -X GET "https://your-domain.com/api/scheduler/document-reminders?key=YOUR_SCHEDULER_API_KEY"
   ```

## WordPress Integration

To connect this system with your existing WordPress site:

1. Create a custom API endpoint in WordPress to expose booking data
2. Configure the API connection in `.env.local`
3. The scheduler will automatically fetch upcoming bookings and send reminders

## License

Private use only. All rights reserved.

# App configuration
NEXT_PUBLIC_BASE_URL=https://documents.villa-claudia.eu
