# Villa Claudia Document Upload System

A secure Next.js web application for Villa Claudia guests to upload travel documents (passports/IDs) before their stay, ensuring compliance with Croatian registration requirements.

## 🌟 Features

- **Secure Document Upload**: Guests can safely upload passport/ID scans through a user-friendly interface
- **Automated Email Reminders**: System automatically sends reminders 7 days before guest check-in
- **Magic Link Access**: Simple URL access with booking ID - no account creation needed
- **WordPress Integration**: Seamlessly integrates with your existing WordPress booking system
- **Email Notifications**: Automated emails to guests and admin notifications
- **Secure Storage**: Documents are stored securely with access control

## 🛠️ Tech Stack

- **Framework**: Next.js 16.1.6 (App Router)
- **Runtime**: Bun
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Email**: Nodemailer (SMTP)
- **Deployment**: Hostinger Node.js Hosting

## 📋 Prerequisites

- Bun installed (`curl -fsSL https://bun.sh/install | bash`)
- Node.js 18+ (if not using Bun)
- SMTP email server credentials
- WordPress site with custom API endpoints

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd villaclaudiaupload
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory and configure with your credentials:

```bash
# Application URL
NEXT_PUBLIC_BASE_URL=https://documents.villa-claudia.eu

# Email Configuration (SMTP)
EMAIL_HOST=smtp.hostinger.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@villa-claudia.eu
EMAIL_PASSWORD=your-smtp-password
EMAIL_FROM_NAME=Your Company Name
EMAIL_FROM_ADDRESS=no-reply@villa-claudia.eu
EMAIL_FROM=Your Company <no-reply@villa-claudia.eu>

# Admin Email
ADMIN_EMAIL=admin@villa-claudia.eu

# WordPress API Configuration
WORDPRESS_API_URL=https://your-wordpress-site.com/wp-json
WORDPRESS_API_KEY=your-wordpress-api-key

# Cron Job Security (for /api/cron/document-reminders endpoint)
CRON_SECRET=generate-a-secure-random-string
```

### 4. Run Development Server

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```path
villaclaudiaupload/
├── app/
│   ├── api/
│   │   ├── booking/          # Fetch booking details
│   │   ├── cron/
│   │   │   └── document-reminders/  # Automated reminder endpoint
│   │   ├── test-email/       # Test email configuration
│   │   └── upload/           # Handle document uploads
│   ├── uploads/
│   │   └── [secureBookingId]/ # Secure upload page for guests
│   ├── layout.tsx
│   └── page.tsx              # Home page
├── components/
│   ├── document-upload-form.tsx
│   └── ui/                   # Reusable UI components
├── lib/
│   ├── document-scheduler.ts # Reminder logic
│   ├── email-config.ts       # Email configuration
│   └── utils.ts
├── .env                      # Environment variables (DO NOT COMMIT)
├── next.config.ts
└── package.json
```

## 🔐 API Endpoints

### `/api/booking?bookingId={id}`

Fetch booking details from WordPress.

### `/api/upload`

Handle document uploads from guests.

- Validates booking ID and guest email
- Stores documents securely
- Sends confirmation emails

### `/api/cron/document-reminders`

Automated endpoint for sending document reminders.

- **Method**: POST
- **Authentication**: Bearer token in Authorization header
- **Usage**: Call daily via cron job

**Example:**

```bash
curl -X POST https://documents.villa-claudia.eu/api/cron/document-reminders \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### `/api/test-email`

Test email configuration (development only).

## 📧 Automated Email Reminders

The system automatically sends reminder emails to guests who:

- Have a confirmed booking
- Check-in is in approximately 7 days (6.5-7.5 days)
- Haven't uploaded their documents yet

### Setting Up Cron Job

#### Option 1: Hostinger Cron Jobs

1. Log into Hostinger control panel
2. Navigate to Advanced → Cron Jobs
3. Create a new cron job:
   - **Schedule**: Daily at midnight (0 0 ** *)
   - **Command**:

     ```bash
     curl -X POST https://documents.villa-claudia.eu/api/cron/document-reminders \
       -H "Authorization: Bearer YOUR_CRON_SECRET"
     ```

#### Option 2: External Cron Service (cron-job.org)

1. Sign up at [cron-job.org](https://cron-job.org)
2. Create a new cron job:
   - **URL**: `https://documents.villa-claudia.eu/api/cron/document-reminders`
   - **Method**: POST
   - **Headers**: `Authorization: Bearer YOUR_CRON_SECRET`
   - **Schedule**: Daily at 00:00

## 🌐 WordPress Integration

Your WordPress site needs to provide these custom API endpoints:

### Required Endpoints

1. **`GET /wp-json/bookings/upcoming`**
   - Returns upcoming bookings
   - Headers: `x-api-key: YOUR_API_KEY`
   - Response:

     ```json
     [
       {
         "id": "123",
         "bookingId": "ABC123",
         "guestEmail": "guest@example.com",
         "guestName": "John Doe",
         "checkInDate": "2025-05-15",
         "checkOutDate": "2025-05-22",
         "status": "confirmed"
       }
     ]
     ```

2. **`GET /wp-json/booking/{bookingId}`**
   - Returns booking details for a specific booking
   - Headers: `x-api-key: YOUR_API_KEY`

3. **`GET /wp-json/has-documents/{bookingId}`**
   - Check if documents have been uploaded
   - Headers: `x-api-key: YOUR_API_KEY`
   - Response:

     ```json
     {
       "hasDocuments": true
     }
     ```

4. **`POST /wp-json/upload-documents`**
   - Store uploaded document information
   - Headers: `x-api-key: YOUR_API_KEY`

## 🚢 Deployment to Hostinger

### 1. Build for Production

```bash
bun run build
```

This creates a standalone build in `.next/standalone/`.

### 2. Deploy to Hostinger

1. **Upload Files**:
   - Upload `.next/standalone/` folder
   - Upload `public/` folder
   - Upload `.next/static/` folder

2. **Configure Environment Variables**:
   - Go to Hostinger control panel
   - Navigate to your Node.js application settings
   - Add all environment variables from `.env`

3. **Set Start Command**:

   ```bash
   bun server.js
   ```

   Or if Bun isn't supported:

   ```bash
   node server.js
   ```

4. **Configure Port** (if required by Hostinger):
   - Hostinger may assign a specific port
   - Check their documentation for port configuration

### 3. Post-Deployment

1. Test email functionality: `https://documents.villa-claudia.eu/api/test-email`
2. Set up the cron job for automated reminders
3. Test document upload flow with a real booking

## 🧪 Testing

### Test Email Configuration

```bash
curl https://documents.villa-claudia.eu/api/test-email
```

### Test Document Reminder (Manual Trigger)

```bash
curl -X POST https://documents.villa-claudia.eu/api/cron/document-reminders \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Test Booking Fetch

```bash
curl "https://documents.villa-claudia.eu/api/booking?bookingId=ABC123"
```

## 🔒 Security

- **Environment Variables**: Never commit `.env` to version control
- **API Keys**: Use strong, randomly generated keys
- **CRON_SECRET**: Protects cron endpoint from unauthorized access
- **Booking ID Validation**: Upload URLs include booking ID + check-in date for security
- **Email Validation**: Guests must provide the email associated with their booking

## 📝 Development Scripts

```bash
# Development server with Turbopack
bun run dev

# Production build
bun run build

# Start production server
bun run start

# Lint code
bun run lint
```

## 🐛 Troubleshooting

### Email Not Sending

1. Verify SMTP credentials in environment variables
2. Check if port 587 is open (some hosts block it)
3. Test with `/api/test-email` endpoint
4. Check server logs for detailed error messages

### Cron Job Not Running

1. Verify `CRON_SECRET` matches in both `.env` and cron configuration
2. Check cron job logs in Hostinger control panel
3. Test manually with curl command
4. Ensure WordPress API endpoints are accessible

### Documents Not Uploading

1. Check file permissions on server
2. Verify `uploads/` directory exists and is writable
3. Check WordPress API connectivity
4. Review browser console for errors

## 📞 Support

For issues or questions, contact your system administrator.

## 📄 License

Private use only. All rights reserved.

---

### Built with ❤️ for Villa Claudia
