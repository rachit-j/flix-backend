async function fetchUsers() {
    const response = await fetch('/admin/users');
    const users = await response.json();
    const userTableBody = document.getElementById('userTableBody');
    userTableBody.innerHTML = '';
    users.forEach(user => {
      userTableBody.innerHTML += `
        <tr>
          <td>${user.id}</td>
          <td>${user.username}</td>
          <td>${user.role}</td>
          <td>${user.course || 'N/A'}</td>
          <td>
            <button onclick="deleteUser(${user.id})">Delete</button>
          </td>
        </tr>
      `;
    });
  }
  
  async function createUser(event) {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;
    const course = document.getElementById('course').value;
    await fetch('/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role, course }),
    });
    fetchUsers();
  }
  
  async function deleteUser(id) {
    await fetch(`/admin/users/${id}`, { method: 'DELETE' });
    fetchUsers();
  }
  
  document.getElementById('createUserForm').addEventListener('submit', createUser);
  document.addEventListener('DOMContentLoaded', fetchUsers);

  async function fetchAssignments() {
    const response = await fetch('/admin/assignments');
    const assignments = await response.json();
    const assignmentTableBody = document.getElementById('assignmentTableBody');
    assignmentTableBody.innerHTML = '';
    assignments.forEach(assignment => {
      assignmentTableBody.innerHTML += `
        <tr>
          <td>${assignment.id}</td>
          <td>${assignment.title}</td>
          <td>${assignment.course}</td>
          <td>
            <button onclick="deleteAssignment(${assignment.id})">Delete</button>
          </td>
        </tr>
      `;
    });
  }
  
  async function createAssignment(event) {
    event.preventDefault();
    const title = document.getElementById('assignmentTitle').value;
    const course = document.getElementById('assignmentCourse').value;
  
    await fetch('/admin/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, course }),
    });
  
    fetchAssignments(); // Refresh the list
  }
  
  async function deleteAssignment(id) {
    await fetch(`/admin/assignments/${id}`, { method: 'DELETE' });
    fetchAssignments(); // Refresh the list
  }
  
  // Attach event listeners
  document.getElementById('createAssignmentForm').addEventListener('submit', createAssignment);
  document.addEventListener('DOMContentLoaded', fetchAssignments);