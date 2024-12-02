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

document.addEventListener('DOMContentLoaded', () => {
  fetchAssignments();
  fetchSubmissions();

  document.getElementById('filterSubmissions').addEventListener('click', fetchFilteredSubmissions);
});