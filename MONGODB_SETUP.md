# 🚀 Quick MongoDB Setup (2 Minutes)

## Option 1: MongoDB Atlas (Cloud - Recommended)

1. **Go to**: https://cloud.mongodb.com
2. **Sign Up/Login**: Create free account
3. **Create Cluster**: 
   - Click "Build a Database"
   - Choose "M0 Sandbox" (FREE)
   - Select any region
   - Click "Create"

4. **Create User**:
   - Username: `admin`
   - Password: `password123` (or generate)
   - Click "Create User"

5. **Network Access**:
   - Click "Add IP Address"
   - Click "Allow Access from Anywhere" (for development)
   - Click "Confirm"

6. **Get Connection String**:
   - Click "Connect" → "Drivers" → "Node.js"
   - Copy the connection string
   - Replace `<password>` with your password

7. **Update backend/.env**:
   ```
   MONGODB_URI=mongodb+srv://admin:password123@cluster0.xxxxx.mongodb.net/exammonitor?retryWrites=true&w=majority
   ```

## Option 2: Local MongoDB (Windows)

1. **Download**: https://www.mongodb.com/try/download/community
2. **Install**: Run the installer, choose "Complete" setup
3. **Start Service**: 
   ```cmd
   net start MongoDB
   ```
4. **Keep current .env**: Already configured for local connection

## Option 3: Docker (One Command)

```bash
# Start MongoDB container
docker run -d --name mongodb -p 27017:27017 mongo:7.0

# Backend will connect automatically
```

---

**After MongoDB is running, restart the backend server to connect to database.**