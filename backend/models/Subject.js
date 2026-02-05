const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Subject name is required'],
    trim: true,
    maxlength: [100, 'Subject name cannot be more than 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Subject code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^[A-Z0-9]{3,10}$/, 'Subject code must be 3-10 alphanumeric characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    trim: true
  },
  college: {
    type: String,
    required: [true, 'College is required'],
    trim: true
  },
  semester: {
    type: Number,
    required: [true, 'Semester is required'],
    min: [1, 'Semester must be at least 1'],
    max: [8, 'Semester cannot be more than 8']
  },
  credits: {
    type: Number,
    required: [true, 'Credits are required'],
    min: [1, 'Credits must be at least 1'],
    max: [10, 'Credits cannot be more than 10']
  },
  teachers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  exams: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  academicYear: {
    type: String,
    required: [true, 'Academic year is required'],
    match: [/^\d{4}-\d{4}$/, 'Academic year must be in format YYYY-YYYY']
  },
  syllabus: {
    type: String,
    trim: true
  },
  prerequisites: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Index for better query performance
subjectSchema.index({ code: 1 });
subjectSchema.index({ department: 1, semester: 1 });
subjectSchema.index({ college: 1 });
subjectSchema.index({ academicYear: 1 });

// Virtual for full subject identifier
subjectSchema.virtual('fullCode').get(function() {
  return `${this.code} - ${this.name}`;
});

// Method to check if a teacher is assigned to this subject
subjectSchema.methods.hasTeacher = function(teacherId) {
  return this.teachers.some(id => id.toString() === teacherId.toString());
};

// Method to check if a student is enrolled in this subject
subjectSchema.methods.hasStudent = function(studentId) {
  return this.students.some(id => id.toString() === studentId.toString());
};

// Method to get basic info without sensitive data
subjectSchema.methods.getPublicInfo = function() {
  return {
    _id: this._id,
    name: this.name,
    code: this.code,
    description: this.description,
    department: this.department,
    college: this.college,
    semester: this.semester,
    credits: this.credits,
    academicYear: this.academicYear,
    fullCode: this.fullCode
  };
};

// Ensure virtual fields are serialized
subjectSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('Subject', subjectSchema);