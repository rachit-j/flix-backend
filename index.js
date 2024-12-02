// Add this at the top of your index.js to load environment variables from .env
require('dotenv').config(); // Load the .env file

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const fs = require("fs");

const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(cookieParser());
app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: true }));

const path = require("path");

// Serve static files (e.g., JS, CSS) from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// Use the secret key and root password from .env
const SECRET_KEY = process.env.SECRET_KEY || "your_secret_key";  // Using .env for secret key
const ROOT_PASSWORD = process.env.ROOT_PASSWORD; // Use the root password from the .env file

// Initialize SQLite Database
const db = new sqlite3.Database("./database.sqlite", (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
    process.exit(1);
  } else {
    console.log("Connected to SQLite database");

    // Create tables if they don't exist
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT CHECK(role IN ('student', 'instructor', 'admin')) NOT NULL,
        course TEXT
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        course TEXT NOT NULL
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assignment_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        code TEXT NOT NULL,
        graded BOOLEAN DEFAULT 0,
        grade TEXT,
        FOREIGN KEY(assignment_id) REFERENCES assignments(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `);
    console.log("Tables created or verified");

    // Add default admin if not exists
    bcrypt.hash(ROOT_PASSWORD, 10, (err, hash) => {
      if (err) {
        console.error("Error hashing password:", err.message);
      } else {
        db.run(
          `INSERT OR IGNORE INTO users (username, password, role, course) VALUES ('root', ?, 'admin', NULL)`,
          [hash],
          (err) => {
            if (err) {
              console.error("Error creating default admin:", err.message);
            } else {
              console.log("Default admin created or already exists");
            }
          }
        );
      }
    });
  }
});

// JWT Authentication Middleware
function authenticate(req, res, next) {
  const token = req.cookies.authToken; // Get token from cookies
  if (!token) {
    return res.redirect("/login"); // Redirect to login page if no token
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.redirect("/login"); // Redirect if token is invalid or expired
    }
    req.user = user; // Attach user to request for role-based checks
    next();
  });
}

// Role-Based Authorization Middleware
function authorize(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: "Forbidden access" });
    }
    next();
  };
}

// Login Endpoint
app.post('/login', (req, res) => {
    const { username, password } = req.body;
  
    if (!username || !password) {
      return res.status(400).json({ error: 'Please provide both username and password' });
    }
  
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
      if (err) {
        console.error('Database error:', err.message);
        return res.status(500).json({ error: 'An internal error occurred' });
      }
  
      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
  
      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) {
          console.error('Error during password comparison:', err.message);
          return res.status(500).json({ error: 'An internal error occurred' });
        }
  
        if (!isMatch) {
          return res.status(401).json({ error: 'Invalid username or password' });
        }
  
        const token = jwt.sign(
          { id: user.id, username: user.username, role: user.role },
          SECRET_KEY,
          { expiresIn: '1h' }
        );
  
        res.cookie('authToken', token, { httpOnly: true });
  
        // Respond with user role for frontend redirection
        res.json({ role: user.role });
      });
    });
  });

// Admin Dashboard
app.get("/admin", authenticate, authorize("admin"), (req, res) => {
    const queries = {
      users: "SELECT * FROM users",
      assignments: "SELECT * FROM assignments",
      submissions: `
        SELECT submissions.*, users.username, assignments.title 
        FROM submissions 
        JOIN users ON submissions.user_id = users.id 
        JOIN assignments ON submissions.assignment_id = assignments.id
      `
    };
  
    db.all(queries.users, [], (err, users) => {
      if (err) {
        console.error("Error fetching users:", err.message);
        return res.status(500).send("Error fetching users");
      }
  
      db.all(queries.assignments, [], (err, assignments) => {
        if (err) {
          console.error("Error fetching assignments:", err.message);
          return res.status(500).send("Error fetching assignments");
        }
  
        db.all(queries.submissions, [], (err, submissions) => {
          if (err) {
            console.error("Error fetching submissions:", err.message);
            return res.status(500).send("Error fetching submissions");
          }
  
          // Pass all data to the EJS template
          res.render("admin", {
            users,
            assignments,
            submissions
          });
        });
      });
    });
  });

// Student Dashboard
app.get('/student', authenticate, authorize('student'), (req, res) => {
    db.all(
      `SELECT submissions.*, assignments.title AS assignment_title 
       FROM submissions 
       JOIN assignments ON submissions.assignment_id = assignments.id 
       WHERE submissions.user_id = ?`,
      [req.user.id],
      (err, submissions) => {
        if (err) {
          console.error('Error fetching student dashboard:', err.message);
          return res.status(500).send('Error fetching dashboard');
        }
        res.render('student', { submissions });
      }
    );
  });

// Submissions Endpoint
app.get("/submissions", authenticate, authorize("admin"), (req, res) => {
  const query = `
    SELECT submissions.*, users.username, assignments.title 
    FROM submissions 
    JOIN users ON submissions.user_id = users.id 
    JOIN assignments ON submissions.assignment_id = assignments.id
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Error fetching submissions:", err.message);
      return res.status(500).json({ error: "Failed to fetch submissions" });
    }

    res.json(rows);
  });
});

// Render Login Page
app.get("/login", (req, res) => {
  res.render("login", { error: null }); // Render login page without an error message initially
});


app.get("/admin/users", authenticate, authorize("admin"), (req, res) => {
    db.all("SELECT * FROM users", [], (err, rows) => {
      if (err) {
        console.error("Error fetching users:", err.message);
        return res.status(500).json({ error: "Failed to fetch users" });
      }
      res.json(rows);
    });
  });

app.post("/admin/users", authenticate, authorize("admin"), (req, res) => {
    const { username, password, role, course } = req.body;
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) {
        console.error("Error hashing password:", err.message);
        return res.status(500).json({ error: "Failed to hash password" });
      }
      db.run(
        `INSERT INTO users (username, password, role, course) VALUES (?, ?, ?, ?)`,
        [username, hash, role, course],
        (err) => {
          if (err) {
            console.error("Error adding user:", err.message);
            return res.status(500).json({ error: "Failed to add user" });
          }
          res.json({ message: "User added successfully" });
        }
      );
    });
  });

app.patch("/admin/users/:id", authenticate, authorize("admin"), (req, res) => {
    const { id } = req.params;
    const { username, role, course } = req.body;
  
    db.run(
      `UPDATE users SET username = ?, role = ?, course = ? WHERE id = ?`,
      [username, role, course, id],
      (err) => {
        if (err) {
          console.error("Error updating user:", err.message);
          return res.status(500).json({ error: "Failed to update user" });
        }
        res.json({ message: "User updated successfully" });
      }
    );
  });

app.delete("/admin/users/:id", authenticate, authorize("admin"), (req, res) => {
    const { id } = req.params;
  
    db.run(`DELETE FROM users WHERE id = ?`, [id], (err) => {
      if (err) {
        console.error("Error deleting user:", err.message);
        return res.status(500).json({ error: "Failed to delete user" });
      }
      res.json({ message: "User deleted successfully" });
    });
  });


app.get("/admin/assignments", authenticate, authorize("admin"), (req, res) => {
    db.all("SELECT * FROM assignments", [], (err, rows) => {
      if (err) {
        console.error("Error fetching assignments:", err.message);
        return res.status(500).json({ error: "Failed to fetch assignments" });
      }
      res.json(rows);
    });
  });


app.post("/admin/assignments", authenticate, authorize("admin"), (req, res) => {
    const { title, course } = req.body;
  
    db.run(`INSERT INTO assignments (title, course) VALUES (?, ?)`, [title, course], (err) => {
      if (err) {
        console.error("Error adding assignment:", err.message);
        return res.status(500).json({ error: "Failed to add assignment" });
      }
      res.json({ message: "Assignment added successfully" });
    });
  });


app.patch("/admin/assignments/:id", authenticate, authorize("admin"), (req, res) => {
    const { id } = req.params;
    const { title, course } = req.body;
  
    db.run(
      `UPDATE assignments SET title = ?, course = ? WHERE id = ?`,
      [title, course, id],
      (err) => {
        if (err) {
          console.error("Error updating assignment:", err.message);
          return res.status(500).json({ error: "Failed to update assignment" });
        }
        res.json({ message: "Assignment updated successfully" });
      }
    );
  });


app.delete("/admin/assignments/:id", authenticate, authorize("admin"), (req, res) => {
    const { id } = req.params;
  
    db.run(`DELETE FROM assignments WHERE id = ?`, [id], (err) => {
      if (err) {
        console.error("Error deleting assignment:", err.message);
        return res.status(500).json({ error: "Failed to delete assignment" });
      }
      res.json({ message: "Assignment deleted successfully" });
    });
  });

app.get("/admin/submissions", authenticate, authorize("admin"), (req, res) => {
    const query = `
      SELECT submissions.*, users.username, assignments.title 
      FROM submissions 
      JOIN users ON submissions.user_id = users.id 
      JOIN assignments ON submissions.assignment_id = assignments.id
    `;
  
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error("Error fetching submissions:", err.message);
        return res.status(500).json({ error: "Failed to fetch submissions" });
      }
      res.json(rows);
    });
  });

app.patch("/admin/submissions/:id", authenticate, authorize("admin"), (req, res) => {
    const { id } = req.params;
    const { graded, grade } = req.body;
  
    db.run(
      `UPDATE submissions SET graded = ?, grade = ? WHERE id = ?`,
      [graded, grade, id],
      (err) => {
        if (err) {
          console.error("Error grading submission:", err.message);
          return res.status(500).json({ error: "Failed to grade submission" });
        }
        res.json({ message: "Submission graded successfully" });
      }
    );
  });

app.get("/admin/schema", authenticate, authorize("admin"), (req, res) => {
    const schema = {
      users: "id INTEGER PRIMARY KEY, username TEXT, password TEXT, role TEXT, course TEXT",
      assignments: "id INTEGER PRIMARY KEY, title TEXT, course TEXT",
      submissions: "id INTEGER PRIMARY KEY, assignment_id INTEGER, user_id INTEGER, code TEXT, graded BOOLEAN, grade TEXT",
    };
    res.json(schema);
  });

app.delete("/admin/reset", authenticate, authorize("admin"), (req, res) => {
    db.serialize(() => {
      db.run("DROP TABLE IF EXISTS users");
      db.run("DROP TABLE IF EXISTS assignments");
      db.run("DROP TABLE IF EXISTS submissions");
    });
    res.json({ message: "All tables have been reset" });
  });

app.get("/admin/export", authenticate, authorize("admin"), (req, res) => {
    db.all("SELECT * FROM users", [], (err, users) => {
      if (err) {
        console.error("Error exporting users:", err.message);
        return res.status(500).json({ error: "Failed to export data" });
      }
      res.json({ users });
    });
  });

// Routes for Panels
app.get("/admin", authenticate, authorize("admin"), (req, res) => {
    res.render("admin");
  });
  
  app.get("/instructor", authenticate, authorize("instructor"), (req, res) => {
    res.render("instructor");
  });
  
  app.get("/dashboard", authenticate, authorize("student"), (req, res) => {
    res.render("dashboard");
  });
  
  // Route for Login
  app.get("/login", (req, res) => {
    res.render("login");
  });


// Fetch assignments for instructors
app.get('/instructor/assignments', authenticate, authorize('instructor'), (req, res) => {
    const query = `
      SELECT * 
      FROM assignments 
      WHERE course IN (
        SELECT course 
        FROM users 
        WHERE id = ?
      )
    `;
  
    db.all(query, [req.user.id], (err, rows) => {
      if (err) {
        console.error('Error fetching assignments for instructor:', err.message);
        return res.status(500).json({ error: 'Failed to fetch assignments' });
      }
      res.json(rows);
    });
  });

  app.get('/instructor/submissions', authenticate, authorize('instructor'), (req, res) => {
  const { assignmentId } = req.query;

  const query = assignmentId
    ? `SELECT submissions.*, users.username, assignments.title
       FROM submissions
       JOIN users ON submissions.user_id = users.id
       JOIN assignments ON submissions.assignment_id = assignments.id
       WHERE assignments.id = ? AND assignments.course IN (
         SELECT course 
         FROM users 
         WHERE id = ?
       )`
    : `SELECT submissions.*, users.username, assignments.title
       FROM submissions
       JOIN users ON submissions.user_id = users.id
       JOIN assignments ON submissions.assignment_id = assignments.id
       WHERE assignments.course IN (
         SELECT course 
         FROM users 
         WHERE id = ?
       )`;

  const params = assignmentId ? [assignmentId, req.user.id] : [req.user.id];
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error fetching submissions:', err.message);
      return res.status(500).json({ error: 'Failed to fetch submissions' });
    }
    res.json(rows);
  });
});
  
  // Grade Submission
  app.patch('/instructor/grade/:id', authenticate, authorize('instructor'), (req, res) => {
    const { id } = req.params;
    const { graded, grade } = req.body;
  
    db.run(
      `UPDATE submissions SET graded = ?, grade = ? WHERE id = ?`,
      [graded, grade, id],
      (err) => {
        if (err) {
          console.error('Error grading submission:', err.message);
          return res.status(500).json({ error: 'Failed to grade submission' });
        }
        res.json({ message: 'Submission graded successfully' });
      }
    );
  });

// Fetch assignments for students
app.get('/dashboard/assignments', authenticate, authorize('student'), (req, res) => {
    const query = `
      SELECT * FROM assignments 
      WHERE course IN (SELECT course FROM users WHERE id = ?)
    `;
  
    db.all(query, [req.user.id], (err, rows) => {
      if (err) {
        console.error('Error fetching assignments:', err.message);
        return res.status(500).json({ error: 'Failed to fetch assignments' });
      }
      res.json(rows);
    });
  });

// Submit code for an assignment
app.post('/dashboard/submit', authenticate, authorize('student'), (req, res) => {
    const { assignment_id, code } = req.body;
  
    // Insert submission
    db.run(
      `INSERT INTO submissions (assignment_id, user_id, code) VALUES (?, ?, ?)`,
      [assignment_id, req.user.id, code],
      (err) => {
        if (err) {
          console.error('Error submitting code:', err.message);
          return res.status(500).json({ error: 'Failed to submit assignment' });
        }
        res.json({ message: 'Assignment submitted successfully' });
      }
    );
  });

// View all submissions for the student
app.get('/dashboard/submissions', authenticate, authorize('student'), (req, res) => {
    const query = `
      SELECT submissions.*, assignments.title
      FROM submissions
      JOIN assignments ON submissions.assignment_id = assignments.id
      WHERE submissions.user_id = ?
    `;
  
    db.all(query, [req.user.id], (err, rows) => {
      if (err) {
        console.error('Error fetching submissions:', err.message);
        return res.status(500).json({ error: 'Failed to fetch submissions' });
      }
      res.json(rows);
    });
  });

// Check if student has already submitted an assignment
app.get('/dashboard/assignments/status', authenticate, (req, res) => {
    const { assignmentId } = req.query;
  
    const query = `
      SELECT id FROM submissions 
      WHERE assignment_id = ? AND user_id = ?
    `;
  
    db.get(query, [assignmentId, req.user.id], (err, submission) => {
      if (err) {
        return res.status(500).json({ error: 'Error checking submission status' });
      }
      res.json({ submitted: !!submission });
    });
  });

// Create an assignment (instructor only)
app.post('/instructor/assignments', authenticate, authorize('instructor'), (req, res) => {
    const { title, course } = req.body;
    
    db.run(
      `INSERT INTO assignments (title, course, locked) VALUES (?, ?, ?)`,
      [title, course, 0],
      (err) => {
        if (err) {
          console.error('Error creating assignment:', err.message);
          return res.status(500).json({ error: 'Failed to create assignment' });
        }
        res.json({ message: 'Assignment created successfully' });
      }
    );
  });

// Get submission status for each student (Instructor)
app.get('/instructor/assignments/:id/status', authenticate, authorize('instructor'), (req, res) => {
    const assignmentId = req.params.id;
  
    const query = `
      SELECT users.username, 
             CASE 
               WHEN submissions.id IS NOT NULL THEN 'Submitted'
               ELSE 'Not Submitted'
             END AS submission_status
      FROM users
      LEFT JOIN submissions ON submissions.user_id = users.id AND submissions.assignment_id = ?
      WHERE users.role = 'student'
    `;
  
    db.all(query, [assignmentId], (err, rows) => {
      if (err) {
        console.error('Error fetching submission status:', err.message);
        return res.status(500).json({ error: 'Failed to fetch submission status' });
      }
      res.json(rows); // Return a list of students with their submission status
    });
  });

  // Lock an assignment (instructor/admin only)
app.patch('/admin/assignments/lock/:id', authenticate, authorize('admin', 'instructor'), (req, res) => {
    const { id } = req.params;
  
    db.run(
      `UPDATE assignments SET locked = 1 WHERE id = ?`,
      [id],
      (err) => {
        if (err) {
          console.error('Error locking assignment:', err.message);
          return res.status(500).json({ error: 'Failed to lock assignment' });
        }
        res.json({ message: 'Assignment locked successfully' });
      }
    );
  });

  app.patch('/instructor/assignments/lock/:id', authenticate, authorize('admin', 'instructor'), (req, res) => {
    const { id } = req.params;
  
    db.run(
      `UPDATE assignments SET locked = 1 WHERE id = ?`,
      [id],
      (err) => {
        if (err) {
          console.error('Error locking assignment:', err.message);
          return res.status(500).json({ error: 'Failed to lock assignment' });
        }
        res.json({ message: 'Assignment locked successfully' });
      }
    );
  });

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});