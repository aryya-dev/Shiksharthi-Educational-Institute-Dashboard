const XLSX = require('xlsx');

const data = [
  {
    'Name': 'Amit Kumar',
    'Parent Name': 'Rajesh Kumar',
    'Date of Birth': '2008-06-15',
    'Gender': 'Male',
    'School': 'BGP High School',
    'Address': 'Baguipara, West Bengal',
    'Class': '11',
    'Batch Name': '11 JEE',
    'Package Type': 'JEE',
    'Subjects': 'Physics, Chemistry, Mathematics'
  },
  {
    'Name': 'Sneha Sen',
    'Parent Name': 'Subhas Sen',
    'Date of Birth': '2008-09-20',
    'Gender': 'Female',
    'School': 'BGP Girls School',
    'Address': 'Baguipara, West Bengal',
    'Class': '11',
    'Batch Name': '11 NEET',
    'Package Type': 'NEET',
    'Subjects': 'Physics, Chemistry, Biology'
  },
  {
    // Invalid row (missing Name) to verify the error preview
    'Name': '',
    'Parent Name': 'Test Parent',
    'Date of Birth': '2008-01-01',
    'Gender': 'Male',
    'School': 'Test School',
    'Address': 'Test Address',
    'Class': '12',
    'Batch Name': '12 Boards',
    'Package Type': 'Boards',
    'Subjects': 'Physics'
  }
];

const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Students');
XLSX.writeFile(wb, 'scratch/test_students.xlsx');
console.log('Created scratch/test_students.xlsx successfully!');
