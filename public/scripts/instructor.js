// Fetch Submissions
async function fetchSubmissions() {
  try {
    const response = await fetch('/instructor/submissions');
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
          <td>${submission.username}</td>
          <td><pre>${submission.code}</pre></td>
          <td>${submission.grade || 'Ungraded'}</td>
          <td>
            <input type="text" id="grade-${submission.id}" placeholder="Grade" />
            <button onclick="gradeSubmission(${submission.id})">Grade</button>
          </td>
        </tr>
      `;
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    alert('An error occurred while fetching submissions.');
  }
}

// Grade Submission
async function gradeSubmission(submissionId) {
  const gradeInput = document.getElementById(`grade-${submissionId}`);
  const grade = gradeInput.value.trim();

  if (!grade) {
    alert('Please enter a grade before submitting.');
    return;
  }

  try {
    const response = await fetch(`/instructor/grade/${submissionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graded: true, grade }),
    });

    if (!response.ok) {
      throw new Error('Failed to grade submission');
    }

    alert('Submission graded successfully.');
    fetchSubmissions(); // Refresh submissions list
  } catch (error) {
    console.error('Error grading submission:', error);
    alert('An error occurred while grading the submission.');
  }
}

// Fetch Assignments
async function fetchAssignments() {
  try {
    const response = await fetch('/instructor/assignments');
    if (!response.ok) {
      throw new Error('Failed to fetch assignments');
    }

    const assignments = await response.json();
    const assignmentDropdown = document.getElementById('assignmentDropdown');
    assignmentDropdown.innerHTML = '<option value="">Select Assignment</option>';

    assignments.forEach((assignment) => {
      assignmentDropdown.innerHTML += `
        <option value="${assignment.id}">${assignment.title}</option>
      `;
    });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    alert('An error occurred while fetching assignments.');
  }
}

// Fetch Filtered Submissions
async function fetchFilteredSubmissions() {
  const assignmentId = document.getElementById('assignmentDropdown').value;
  if (!assignmentId) {
    alert('Please select an assignment.');
    return;
  }

  try {
    const response = await fetch(`/instructor/submissions?assignmentId=${assignmentId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch filtered submissions');
    }

    const submissions = await response.json();
    const submissionsTableBody = document.getElementById('submissionsTableBody');
    submissionsTableBody.innerHTML = '';

    submissions.forEach((submission) => {
      submissionsTableBody.innerHTML += `
        <tr>
          <td>${submission.title}</td>
          <td>${submission.username}</td>
          <td><pre>${submission.code}</pre></td>
          <td>${submission.grade || 'Ungraded'}</td>
          <td>
            <input type="text" id="grade-${submission.id}" placeholder="Grade" />
            <button onclick="gradeSubmission(${submission.id})">Grade</button>
          </td>
        </tr>
      `;
    });
  } catch (error) {
    console.error('Error fetching filtered submissions:', error);
    alert('An error occurred while fetching filtered submissions.');
  }
}

// Create New Assignment
async function createAssignment(event) {
  event.preventDefault();

  const title = document.getElementById('assignmentTitle').value;
  const course = document.getElementById('assignmentCourse').value;

  try {
    const response = await fetch('/instructor/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, course }),
    });

    if (!response.ok) {
      throw new Error('Failed to create assignment');
    }

    alert('Assignment created successfully');
    fetchAssignments(); // Refresh the assignments list
  } catch (error) {
    console.error('Error creating assignment:', error);
    alert('An error occurred while creating the assignment.');
  }
}

// Lock Assignment
async function lockAssignment() {
  const assignmentId = document.getElementById('assignmentDropdown').value;

  if (!assignmentId) {
    alert('Please select an assignment to lock.');
    return;
  }

  try {
    const response = await fetch(`/instructor/assignments/lock/${assignmentId}`, {
      method: 'PATCH',
    });

    if (response.ok) {
      alert('Assignment locked successfully');
    } else {
      alert('Error locking assignment');
    }
  } catch (error) {
    console.error('Error locking assignment:', error);
    alert('An error occurred while locking the assignment.');
  }
}

// Fetch Submission Status for Each Student
async function fetchSubmissionStatus() {
  const assignmentId = document.getElementById('assignmentDropdown').value;

  if (!assignmentId) {
    alert('Please select an assignment to see submission statuses.');
    return;
  }

  try {
    const response = await fetch(`/instructor/assignments/${assignmentId}/status`);
    if (!response.ok) {
      throw new Error('Failed to fetch submission status');
    }

    const students = await response.json();
    const submissionStatusTableBody = document.getElementById('submissionStatusTableBody');
    submissionStatusTableBody.innerHTML = '';

    students.forEach((student) => {
      submissionStatusTableBody.innerHTML += `
        <tr>
          <td>${student.username}</td>
          <td>${student.submission_status}</td>
        </tr>
      `;
    });
  } catch (error) {
    console.error('Error fetching submission status:', error);
    alert('An error occurred while fetching submission status.');
  }
}


// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  fetchAssignments();
  fetchSubmissions();

  document.getElementById('filterSubmissions').addEventListener('click', fetchFilteredSubmissions);
  document.getElementById('createAssignmentForm').addEventListener('submit', createAssignment);
});