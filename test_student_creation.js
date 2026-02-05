// Test script to verify the student creation API request format
// This simulates the frontend request to help debug the 400 error

const testStudentData = {
  fullName: "Test Student",
  email: "test.student@example.com",
  phoneNumber: "1234567890", // 10 digits
  course: "Computer Science",
  semester: 3,
  batch: "2024-A",
  rollNumber: "CS2024001"
};

console.log("Frontend is sending this data format:");
console.log(JSON.stringify(testStudentData, null, 2));

console.log("\nExpected backend fields from User model:");
console.log("- fullName (required)");
console.log("- email (required, unique, valid email format)");
console.log("- phoneNumber (optional, must be 10 digits if provided)");
console.log("- course (optional)");
console.log("- semester (optional, 1-8)");
console.log("- batch (optional)");
console.log("- rollNumber (optional, unique if provided)");

console.log("\nBackend will auto-generate:");
console.log("- userType: 'student'");
console.log("- password: random 8-character hex string");
console.log("- studentId: auto-generated unique ID");
console.log("- isActive: true (default)");

// Validation checks the frontend should perform:
console.log("\nFrontend validation:");
console.log("✓ Full Name: required");
console.log("✓ Email: required, valid format");
console.log("✓ Phone Number: optional, but if provided must be exactly 10 digits");
console.log("✓ Semester: optional, but if provided must be 1-8");