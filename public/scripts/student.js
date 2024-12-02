// Fetch Assignments for the Student
async function fetchAssignments() {
    try {
      const response = await fetch('/dashboard/assignments');
      if (!response.ok) {
        throw new Error('Failed to fetch assignments');
      }
  
      const assignments = await response.json();
      const assignmentsTableBody = document.getElementById('assignmentsTableBody');
      assignmentsTableBody.innerHTML = '';
  
      assignments.forEach((assignment) => {
        assignmentsTableBody.innerHTML += `
          <tr>
            <td>${assignment.title}</td>
            <td><button onclick="submitAssignment(${assignment.id})">Submit</button></td>
          </tr>
        `;
      });
    } catch (error) {
      console.error('Error fetching assignments:', error);
      alert('An error occurred while fetching assignments.');
    }
  }
  
  // Submit Code for an Assignment
  async function submitAssignment(assignmentId) {
    const code = prompt("Enter your code for this assignment:");
  
    if (!code) {
      alert('You must enter code to submit.');
      return;
    }
  
    try {
      const response = await fetch('/dashboard/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: assignmentId, code }),
      });
  
      if (!response.ok) {
        throw new Error('Failed to submit assignment');
      }
  
      alert('Assignment submitted successfully!');
    } catch (error) {
      console.error('Error submitting assignment:', error);
      alert('An error occurred while submitting the assignment.');
    }
  }
  
  // Fetch Submissions
  async function fetchSubmissions() {
    try {
      const response = await fetch('/dashboard/submissions');
      if (!response.ok) {
        throw new Error('Failed to fetch submissions');
      }
  
      const submissions = await response.json();
      const submissionsTableBody = document.getElementById('submissionsTableBody');
      submissionsTableBody.innerHTML = '';
  
      submissions.forEach((submission) => {
        submissionsTableBody.innerHTML += `
          <tr>
            <td>${submission.title}</td>
            <td><pre>${submission.code}</pre></td>
            <td>${submission.grade || 'Pending'}</td>
          </tr>
        `;
      });
    } catch (error) {
      console.error('Error fetching submissions:', error);
      alert('An error occurred while fetching submissions.');
    }
  }
  
  // Attach event listeners when the page loads
  document.addEventListener('DOMContentLoaded', () => {
    fetchAssignments();
    fetchSubmissions();
  });