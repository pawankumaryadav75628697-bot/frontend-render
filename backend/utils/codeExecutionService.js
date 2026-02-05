const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class CodeExecutionService {
  constructor() {
    this.tempDir = path.join(__dirname, '../temp');
    this.ensureTempDir();
  }

  async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Error creating temp directory:', error);
    }
  }

  // Execute code for a specific language
  async executeCode(code, language, input = '', timeLimit = 5000) {
    const executionId = uuidv4();
    const executionDir = path.join(this.tempDir, executionId);
    
    try {
      // Create execution directory
      await fs.mkdir(executionDir, { recursive: true });
      
      let result;
      
      switch (language.toLowerCase()) {
        case 'python':
          result = await this.executePython(code, input, executionDir, timeLimit);
          break;
        case 'java':
          result = await this.executeJava(code, input, executionDir, timeLimit);
          break;
        case 'c':
          result = await this.executeC(code, input, executionDir, timeLimit);
          break;
        case 'cpp':
        case 'c++':
          result = await this.executeCpp(code, input, executionDir, timeLimit);
          break;
        default:
          throw new Error(`Unsupported language: ${language}`);
      }
      
      return result;
    } catch (error) {
      console.error('Code execution error:', error);
      return {
        success: false,
        output: '',
        error: error.message,
        executionTime: 0
      };
    } finally {
      // Cleanup - remove execution directory
      try {
        await this.cleanupDirectory(executionDir);
      } catch (error) {
        console.warn('Cleanup error:', error);
      }
    }
  }

  // Execute Python code
  async executePython(code, input, executionDir, timeLimit) {
    const fileName = 'solution.py';
    const filePath = path.join(executionDir, fileName);
    
    await fs.writeFile(filePath, code);
    
    // Use quotes around the file path to handle spaces in the path
    return this.runCommand('python', [`"${filePath}"`], input, timeLimit);
  }

  // Execute Java code
  async executeJava(code, input, executionDir, timeLimit) {
    const className = this.extractJavaClassName(code) || 'Solution';
    const fileName = `${className}.java`;
    const filePath = path.join(executionDir, fileName);
    
    await fs.writeFile(filePath, code);
    
    // Compile Java code with quoted paths
    const compileResult = await this.runCommand('javac', [`"${filePath}"`], '', 5000);
    if (!compileResult.success) {
      return {
        success: false,
        output: '',
        error: `Compilation Error: ${compileResult.error}`,
        executionTime: compileResult.executionTime
      };
    }
    
    // Execute compiled Java code with quoted paths
    return this.runCommand('java', ['-cp', `"${executionDir}"`, className], input, timeLimit);
  }

  // Execute C code
  async executeC(code, input, executionDir, timeLimit) {
    const fileName = 'solution.c';
    const filePath = path.join(executionDir, fileName);
    const executablePath = path.join(executionDir, 'solution.exe');
    
    await fs.writeFile(filePath, code);
    
    // Compile C code with quoted paths
    const compileResult = await this.runCommand('gcc', [`"${filePath}"`, '-o', `"${executablePath}"`], '', 10000);
    if (!compileResult.success) {
      return {
        success: false,
        output: '',
        error: `Compilation Error: ${compileResult.error}`,
        executionTime: compileResult.executionTime
      };
    }
    
    // Execute compiled C code with quoted path
    return this.runCommand(`"${executablePath}"`, [], input, timeLimit);
  }

  // Execute C++ code
  async executeCpp(code, input, executionDir, timeLimit) {
    const fileName = 'solution.cpp';
    const filePath = path.join(executionDir, fileName);
    const executablePath = path.join(executionDir, 'solution.exe');
    
    await fs.writeFile(filePath, code);
    
    // Compile C++ code with quoted paths
    const compileResult = await this.runCommand('g++', [`"${filePath}"`, '-o', `"${executablePath}"`], '', 10000);
    if (!compileResult.success) {
      return {
        success: false,
        output: '',
        error: `Compilation Error: ${compileResult.error}`,
        executionTime: compileResult.executionTime
      };
    }
    
    // Execute compiled C++ code with quoted path
    return this.runCommand(`"${executablePath}"`, [], input, timeLimit);
  }

  // Generic command runner with timeout and input support
  async runCommand(command, args = [], input = '', timeLimit = 5000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });

      let stdout = '';
      let stderr = '';
      let isTimedOut = false;

      // Set up timeout
      const timeout = setTimeout(() => {
        isTimedOut = true;
        child.kill('SIGKILL');
        resolve({
          success: false,
          output: stdout,
          error: `Time Limit Exceeded (${timeLimit}ms)`,
          executionTime: Date.now() - startTime,
          timedOut: true
        });
      }, timeLimit);

      // Handle stdout
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      // Handle stderr
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle process completion
      child.on('close', (code) => {
        if (isTimedOut) return;
        
        clearTimeout(timeout);
        const executionTime = Date.now() - startTime;
        
        if (code === 0) {
          resolve({
            success: true,
            output: stdout,
            error: stderr,
            executionTime,
            exitCode: code
          });
        } else {
          resolve({
            success: false,
            output: stdout,
            error: stderr || `Process exited with code ${code}`,
            executionTime,
            exitCode: code
          });
        }
      });

      // Handle process errors
      child.on('error', (error) => {
        if (isTimedOut) return;
        
        clearTimeout(timeout);
        resolve({
          success: false,
          output: stdout,
          error: `Execution Error: ${error.message}`,
          executionTime: Date.now() - startTime
        });
      });

      // Send input to the process
      if (input) {
        child.stdin.write(input);
        child.stdin.end();
      } else {
        child.stdin.end();
      }
    });
  }

  // Extract Java class name from code
  extractJavaClassName(code) {
    const match = code.match(/public\s+class\s+(\w+)/);
    return match ? match[1] : null;
  }

  // Test code against multiple test cases
  async testCode(code, language, testCases, timeLimit = 5000) {
    const results = [];
    
    for (const testCase of testCases) {
      const result = await this.executeCode(code, language, testCase.input, timeLimit);
      
      const testResult = {
        input: testCase.input,
        expectedOutput: testCase.expectedOutput.trim(),
        actualOutput: result.output.trim(),
        passed: result.success && result.output.trim() === testCase.expectedOutput.trim(),
        executionTime: result.executionTime,
        error: result.error || null,
        points: testCase.points || 0
      };
      
      results.push(testResult);
    }
    
    // Calculate overall score
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const totalPoints = results.reduce((sum, r) => sum + r.points, 0);
    const earnedPoints = results.filter(r => r.passed).reduce((sum, r) => sum + r.points, 0);
    
    return {
      results,
      summary: {
        totalTests,
        passedTests,
        totalPoints,
        earnedPoints,
        successRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
        scorePercentage: totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0
      }
    };
  }

  // Cleanup directory
  async cleanupDirectory(dirPath) {
    try {
      const files = await fs.readdir(dirPath);
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stat = await fs.stat(filePath);
        if (stat.isDirectory()) {
          await this.cleanupDirectory(filePath);
        } else {
          await fs.unlink(filePath);
        }
      }
      await fs.rmdir(dirPath);
    } catch (error) {
      console.warn('Error cleaning up directory:', error);
    }
  }

  // Validate code syntax (basic validation)
  validateCodeSyntax(code, language) {
    const errors = [];
    
    if (!code || code.trim().length === 0) {
      errors.push('Code cannot be empty');
      return { isValid: false, errors };
    }
    
    // Basic syntax checks for different languages
    switch (language.toLowerCase()) {
      case 'java':
        if (!code.includes('class')) {
          errors.push('Java code must contain a class declaration');
        }
        if (!code.includes('main')) {
          errors.push('Java code must contain a main method');
        }
        break;
        
      case 'c':
        if (!code.includes('#include')) {
          errors.push('C code should include necessary headers');
        }
        if (!code.includes('main')) {
          errors.push('C code must contain a main function');
        }
        break;
        
      case 'cpp':
      case 'c++':
        if (!code.includes('#include')) {
          errors.push('C++ code should include necessary headers');
        }
        if (!code.includes('main')) {
          errors.push('C++ code must contain a main function');
        }
        break;
        
      case 'python':
        // Basic Python syntax check (more lenient)
        if (code.includes('def main') && !code.includes('if __name__')) {
          errors.push('Python code with main function should include if __name__ == "__main__" check');
        }
        break;
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Check if required tools are available
  async checkEnvironment() {
    const tools = {
      python: 'python --version',
      java: 'java -version',
      javac: 'javac -version',
      gcc: 'gcc --version',
      'g++': 'g++ --version'
    };
    
    const availability = {};
    
    for (const [tool, command] of Object.entries(tools)) {
      try {
        const result = await this.runCommand(command.split(' ')[0], command.split(' ').slice(1), '', 3000);
        availability[tool] = result.success;
      } catch (error) {
        availability[tool] = false;
      }
    }
    
    return availability;
  }
}

module.exports = new CodeExecutionService();