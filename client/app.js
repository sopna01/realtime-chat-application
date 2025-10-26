// Elements
const loginEl = document.getElementById('login');
const chatEl = document.getElementById('chat');
const joinBtn = document.getElementById('joinBtn');
const usernameInput = document.getElementById('usernameInput');

const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearBtn');
const emojiBtn = document.getElementById('emojiBtn');
const usersEl = document.getElementById('users');

let myName = null;
let onlineUsers = [];

// Join chat
joinBtn.addEventListener('click', () => {
  const name = usernameInput.value.trim();
  if(!name) return alert('Enter your name');
  myName = name;
  loginEl.style.display = 'none';
  chatEl.style.display = 'flex';
  addSystemMessage(`Welcome ${myName}!`);
  addUser(myName);
});

// Send message
sendBtn.addEventListener('click', sendMessage);
inputEl.addEventListener('keypress', (e) => { if(e.key==='Enter') sendMessage(); });

function sendMessage(){
  const text = inputEl.value.trim();
  if(!text) return;
  addMessage(myName, text, true);
  inputEl.value = '';

  // Simulate message from "other user"
  setTimeout(() => addMessage('Friend', 'Reply: '+text, false), 800);
}

// Add message
function addMessage(username, text, mine){
  const div = document.createElement('div');
  div.classList.add('message', mine?'mine':'other');
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = `${username} • ${new Date().toLocaleTimeString()}`;
  const body = document.createElement('div');
  body.className='text';
  body.textContent = text;
  div.appendChild(meta);
  div.appendChild(body);
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// System message
function addSystemMessage(text){
  const div = document.createElement('div');
  div.className='system';
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Clear chat
clearBtn.addEventListener('click', () => { messagesEl.innerHTML=''; });

// Emoji button
emojiBtn.addEventListener('click', () => {
  inputEl.value += '😊';
});

// Manage online users
function addUser(name){
  if(!onlineUsers.includes(name)) onlineUsers.push(name);
  renderUsers();
}
function renderUsers(){
  usersEl.innerHTML = '';
  onlineUsers.forEach(u => {
    const li = document.createElement('li');
    li.textContent = u;
    usersEl.appendChild(li);
  });
}