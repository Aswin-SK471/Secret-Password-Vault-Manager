const axios = require('axios');

async function testRegister() {
  try {
    const response = await axios.post('http://localhost:5000/register', {
      username: 'testuser5',
      password: 'testpass'
    });
    console.log('Response:', response.data);
  } catch (error) {
    console.log('Error:', error.response?.data || error.message);
  }
}

testRegister();