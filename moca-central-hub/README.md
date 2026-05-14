# Moca Hub - User & Client Management System

A centralized management hub for the Moca ecosystem, providing user authentication, client management, configuration management, and application registry with role-based access control.

## Features

- **Multi-tenant Client Management**: Manage multiple client organizations
- **User Management**: Role-based access control (Admin, Manager, User, Viewer)
- **Multi-Client Users**: Assign users to multiple clients simultaneously
- **Job Titles**: Track user roles within their organization (SEO, ADV, Team Leader, etc.)
- **CSV Import**: Bulk user creation via CSV upload
- **Advanced App Access**: Control application access by User, Client, Role, or Minimum Level
- **Configuration Management**: Store and manage client-specific configurations and API keys
- **Application Registry**: Centralized registry of all ecosystem applications with access control
- **Logging & Debugging**: System-wide logging with real-time monitoring
- **API Documentation**: Complete API reference for integrations
- **Moca Brand Identity**: Custom design following Moca's brand guidelines

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom Moca theme
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase project

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd moca-hub
```

2. Install dependencies
```bash
npm install
```

3. Configure environment variables
The `.env` file should already contain your Supabase credentials:
```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

4. Run database migrations
All database migrations have been applied automatically. The following tables are created:
- `clients` - Client organizations
- `users` - System users with role-based permissions
- `user_clients` - Many-to-many relationship for users assigned to multiple clients
- `configurations` - Client-specific configurations
- `applications` - Application registry
- `application_access` - Application access control (User, Client, Role, Level)
- `logs` - System logs
- `audit_logs` - Audit trail

### Creating the First Admin User

Since the application uses Supabase authentication, you need to create users in two steps:

1. **Create an authentication user in Supabase Dashboard**:
   - Go to your Supabase Dashboard → Authentication → Users
   - Click "Add user" → "Create new user"
   - Enter email and password
   - Note the User ID (UUID)

2. **Create a client in the database**:
```sql
INSERT INTO clients (name, email, status)
VALUES ('Moca Interactive', 'admin@mocainteractive.com', 'active')
RETURNING id;
```

3. **Link the auth user to your users table**:
```sql
INSERT INTO users (id, client_id, email, name, role, level, status)
VALUES (
  '<user-id-from-supabase-auth>',
  '<client-id-from-previous-step>',
  'admin@mocainteractive.com',
  'Admin User',
  'admin',
  5,
  'active'
);
```

Now you can login with the email and password you created!

### Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Deployment

### Netlify Deployment

1. **Connect to GitHub**:
   - Push your code to GitHub
   - Create two branches: `main` (production) and `develop` (staging)

2. **Configure Netlify**:
   - Connect your GitHub repository to Netlify
   - Set build command: `npm run build`
   - Set publish directory: `dist`
   - Enable branch deploys for both `main` and `develop`

3. **Environment Variables**:
   Configure these environment variables in Netlify:
   
   **Frontend (exposed to browser):**
   - `VITE_SUPABASE_URL` - Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
   
   **Backend (Netlify Functions only):**
   - `SUPABASE_URL` - Same as VITE_SUPABASE_URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (from Settings → API)
   
   > ⚠️ **Important**: The `SUPABASE_SERVICE_ROLE_KEY` has elevated privileges and should NEVER be exposed to the frontend.

4. **Deploy**:
   - Push to `develop` branch for staging: `develop--your-site.netlify.app`
   - Push to `main` branch for production: `your-site.netlify.app`

## User Roles and Permissions

### Admin
- Full access to all features
- Can create/edit/delete clients
- Can create/edit/delete users across all clients
- Can manage all configurations
- Can manage application registry and access control

### Manager
- Can manage users within their own client
- Can view and edit configurations for their client
- Can view applications
- Cannot delete clients or create new clients

### User
- Can view data for their own client
- Can access assigned applications
- Limited edit permissions

### Viewer
- Read-only access to data
- Can view assigned applications
- Cannot make any changes

## Application Structure

```
src/
├── components/          # React components
│   ├── LoginPage.tsx   # Authentication page
│   ├── Layout.tsx      # Main layout with navigation
│   ├── Dashboard.tsx   # Dashboard with statistics
│   ├── ClientsPage.tsx # Client management
│   ├── UsersPage.tsx   # User management
│   ├── ConfigurationsPage.tsx # Configuration management
│   ├── ApplicationsPage.tsx   # Application registry
│   ├── LogsPage.tsx    # Logging and debugging
│   └── ApiDocsPage.tsx # API documentation
├── contexts/
│   └── AuthContext.tsx # Authentication context
├── hooks/
│   └── useAuth.ts      # Authentication hook
├── lib/
│   ├── supabase.ts     # Supabase client
│   └── types.ts        # TypeScript types
├── App.tsx             # Main app with routing
└── main.tsx           # App entry point
```

## API Integration

The application includes comprehensive API documentation accessible from the "API Documentation" page. All endpoints require authentication via JWT tokens.

### Netlify Functions

The backend uses Netlify Functions for server-side operations:

#### `POST /api/create-user`
Creates a new user in Supabase Auth and the database. Admin only.

```json
{
  "email": "user@example.com",
  "name": "User Name",
  "client_ids": ["client-uuid-1", "client-uuid-2"],
  "role": "user",
  "level": 2,
  "job_title": "SEO Specialist",
  "send_invite": true
}
```

#### `POST /api/delete-user`
Deletes a user from Supabase Auth and the database. Admin only.

```json
{
  "user_id": "user-uuid"
}
```

#### `POST /api/get-client-config`
Retrieves configuration values for a client. Used by external apps.

```json
{
  "client_id": "client-uuid",
  "config_key": "OPENAI_API_KEY"
}
```

### Base Endpoints

- **Authentication**: `/api/auth/*`
- **Users**: `/api/users/*`
- **Clients**: `/api/clients/*`
- **Configurations**: `/api/config/*`
- **Applications**: `/api/apps/*`

See the API Documentation page in the application for complete endpoint details, examples, and response formats.

## Security Features

- **Row Level Security (RLS)**: All database tables have RLS enabled
- **Multi-tenancy**: Data isolation between clients
- **Role-based Access Control**: Granular permissions based on user roles
- **Audit Logging**: All operations are tracked in audit_logs
- **Sensitive Data Masking**: API keys and sensitive configurations are masked in the UI
- **Synchronized User Deletion**: Deleting a user removes them from both Auth and database

## Brand Guidelines

The application follows Moca Interactive's brand identity:

- **Primary Red**: #E52217
- **Light Red**: #FFE7E6
- **Black**: #191919
- **Gray**: #8A8A8A
- **Font**: Figtree (Google Fonts)

All UI components are designed to maintain brand consistency while providing a professional, modern user experience.

## Support

For issues or questions about Moca Hub, please contact the development team at Moca Interactive.

## License

Proprietary - Moca - Daniele Pisciottano © 2026
