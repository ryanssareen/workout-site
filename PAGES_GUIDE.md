# 📄 Application Pages & Routes

## Public Pages (No Authentication Required)

### 🏠 Landing Page
- **URL**: http://localhost:3000/
- **Features**:
  - Welcome hero section
  - Feature highlights (4 cards)
  - Call-to-action buttons
  - Login/Sign up navigation

---

## Authentication Pages

### 🔐 Login
- **URL**: http://localhost:3000/login
- **Features**:
  - Email/password form
  - Error handling
  - Redirect to dashboard on success

### ✍️ Register
- **URL**: http://localhost:3000/register
- **Features**:
  - Full name input
  - Email/password form
  - Role selection (Coach/Student)
  - Optional coach ID for students
  - Auto-login after registration

---

## Protected Dashboard Pages (Authentication Required)

### 📊 Dashboard
- **URL**: http://localhost:3000/dashboard
- **Features**:
  - Welcome message with user name
  - Statistics cards:
    - Total workouts
    - Completed count
    - Pending count
  - Upcoming workouts list (5 most recent)
  - Quick "Create Workout" button (coaches only)

### 💪 Workouts List
- **URL**: http://localhost:3000/workouts
- **Features**:
  - All workouts displayed as cards
  - Filter by completion status
  - Edit button (coaches only)
  - Delete button (coaches only)
  - Mark complete toggle (all users)
  - Workout details: name, type, description, date

### ➕ Create Workout
- **URL**: http://localhost:3000/workouts/new
- **Access**: Coaches only
- **Features**:
  - Two tabs:
    1. **Manual Entry**: Traditional form
    2. **From Whiteboard**: AI-powered upload
  - Form fields:
    - Workout name
    - Type (Swim/Run/Bike/Strength)
    - Description
    - Date picker
    - Duration (optional)
    - Assign to student dropdown
  - Real-time validation
  - Success/error notifications

### ✏️ Edit Workout
- **URL**: http://localhost:3000/workouts/[id]/edit
- **Access**: Coaches only (who created the workout)
- **Features**:
  - Pre-filled form with existing data
  - Same validation as create
  - Update confirmation

### 👁️ View Workout
- **URL**: http://localhost:3000/workouts/[id]
- **Access**: Creator (coach) or assignee (student)
- **Features**:
  - Full workout details display
  - Completion status
  - Edit button (if coach)
  - Delete option (if coach)

---

## API Endpoints

### Vision Processing
- **Endpoint**: POST /api/vision/analyze
- **Purpose**: Process whiteboard images with GPT-4 Vision
- **Input**: Base64 image
- **Output**: Extracted workout data (JSON)

### Workout CRUD
- **Endpoints**:
  - GET /api/workouts (list all)
  - POST /api/workouts (create)
  - GET /api/workouts/[id] (get one)
  - PUT /api/workouts/[id] (update)
  - DELETE /api/workouts/[id] (delete)

---

## Navigation Flow

```
Landing Page (/)
    ├── Login (/login) → Dashboard (/dashboard)
    └── Register (/register) → Dashboard (/dashboard)

Dashboard (/dashboard)
    ├── View Stats
    ├── Quick Create (coaches)
    └── Navigate to Workouts List

Workouts List (/workouts)
    ├── View All Workouts
    ├── Create New (coaches) → /workouts/new
    ├── Edit Workout → /workouts/[id]/edit
    ├── View Details → /workouts/[id]
    └── Delete Workout (confirmation modal)

Create Workout (/workouts/new)
    ├── Manual Entry Tab
    └── Whiteboard Upload Tab → AI Processing
```

---

## User Role Permissions

### 👨‍🏫 Coach
- ✅ Create workouts
- ✅ Edit own workouts
- ✅ Delete own workouts
- ✅ Assign workouts to students
- ✅ View all created workouts
- ✅ Use whiteboard vision feature
- ✅ Mark workouts complete

### 👨‍🎓 Student
- ✅ View assigned workouts
- ✅ Mark workouts as complete
- ✅ View workout details
- ❌ Cannot create workouts
- ❌ Cannot edit workouts
- ❌ Cannot delete workouts
- ❌ Cannot access coach-only pages

---

## Testing the Pages

### Test as Coach:
1. Register with role "Coach"
2. Go to /dashboard
3. Click "Create Workout"
4. Fill form and assign to a student
5. View in workouts list
6. Test edit/delete

### Test as Student:
1. Register with role "Student"
2. Go to /dashboard
3. View assigned workouts (initially empty)
4. (Have coach assign workout)
5. Mark workout as complete
6. Verify cannot access /workouts/new

---

**All pages are responsive and work on mobile, tablet, and desktop! 📱💻**
