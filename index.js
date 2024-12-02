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

const SECRET_KEY = "your_secret_key"; // Replace with a strong secret key in production

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
    const defaultAdminPassword = "FoodIsGood";
    bcrypt.hash(defaultAdminPassword, 10, (err, hash) => {
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
app.post("/login", (req, res) => {
    console.log("Request Body:", req.body); // Debug request body
    const { username, password } = req.body;
  
    if (!username || !password) {
      console.error("Username or password missing in request");
      return res.render("login", { error: "Please provide both username and password" });
    }
  
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
      if (err) {
        console.error("Database error:", err.message);
        return res.render("login", { error: "An error occurred. Please try again." });
      }
  
      if (!user) {
        console.log("Login failed: User not found.");
        return res.render("login", { error: "Invalid username or password" });
      }
  
      console.log("Stored user record:", user);
  
      bcrypt.compare(password, user.password, (err, result) => {
        if (err) {
          console.error("Error during password comparison:", err.message);
          return res.render("login", { error: "An error occurred. Please try again." });
        }
  
        console.log("Password comparison result:", result);
        if (!result) {
          return res.render("login", { error: "Invalid username or password" });
        }
  
        const token = jwt.sign(
          { id: user.id, username: user.username, role: user.role },
          SECRET_KEY,
          { expiresIn: "1h" }
        );
  
        res.cookie("authToken", token, { httpOnly: true });
        if (user.role === "admin") {
          res.redirect("/admin");
        } else {
          res.redirect("/dashboard");
        }
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

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});