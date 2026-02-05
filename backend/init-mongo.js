// MongoDB initialization script for exam monitoring system
db = db.getSiblingDB('exammonitor');

// Create collections with indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ userType: 1 });
db.users.createIndex({ studentId: 1 }, { sparse: true });

db.exams.createIndex({ instructor: 1 });
db.exams.createIndex({ status: 1 });
db.exams.createIndex({ 'scheduling.startDate': 1, 'scheduling.endDate': 1 });
db.exams.createIndex({ course: 1 });

db.examattempts.createIndex({ exam: 1, student: 1 });
db.examattempts.createIndex({ student: 1, status: 1 });
db.examattempts.createIndex({ exam: 1, status: 1 });
db.examattempts.createIndex({ startTime: 1 });
db.examattempts.createIndex({ 'proctoring.flaggedForReview': 1 });

print('✅ MongoDB initialized successfully for Exam Monitoring System');