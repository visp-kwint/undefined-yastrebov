// Временное хранилище данных (вместо БД)
let users = [
  { id: 1, name: 'Иван Иванов', email: 'ivan@example.com', role: 'admin' },
  { id: 2, name: 'Мария Петрова', email: 'maria@example.com', role: 'user' },
  { id: 3, name: 'Петр Сидоров', email: 'petr@example.com', role: 'user' }
];

let nextId = 4;

// Базовый тест
exports.getTest = (req, res) => {
  res.json({
    success: true,
    message: 'Тестовый API работает!',
    availableEndpoints: {
      'GET /api/test': 'Этот эндпоинт',
      'GET /api/test/health': 'Проверка здоровья сервера',
      'GET /api/test/users': 'Получить всех пользователей',
      'GET /api/test/users/:id': 'Получить пользователя по ID',
      'POST /api/test/echo': 'Эхо POST запроса',
      'POST /api/test/users': 'Создать пользователя',
      'PUT /api/test/users/:id': 'Обновить пользователя',
      'DELETE /api/test/users/:id': 'Удалить пользователя'
    }
  });
};

// Проверка здоровья
exports.healthCheck = (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
};

// Получить всех пользователей
exports.getUsers = (req, res) => {
  res.json({
    success: true,
    count: users.length,
    data: users
  });
};

// Получить пользователя по ID
exports.getUserById = (req, res) => {
  const { id } = req.params;
  const user = users.find(u => u.id === parseInt(id));

  if (!user) {
    return res.status(404).json({
      success: false,
      message: `Пользователь с ID ${id} не найден`
    });
  }

  res.json({
    success: true,
    data: user
  });
};

// Эхо POST запроса
exports.echoPost = (req, res) => {
  res.json({
    success: true,
    message: 'Получены данные',
    receivedData: req.body,
    headers: req.headers
  });
};

// Создать пользователя
exports.createUser = (req, res) => {
  const { name, email, role } = req.body;

  // Валидация
  if (!name || !email) {
    return res.status(400).json({
      success: false,
      message: 'Имя и email обязательны'
    });
  }

  const newUser = {
    id: nextId++,
    name,
    email,
    role: role || 'user'
  };

  users.push(newUser);

  res.status(201).json({
    success: true,
    message: 'Пользователь создан',
    data: newUser
  });
};

// Обновить пользователя
exports.updateUser = (req, res) => {
  const { id } = req.params;
  const { name, email, role } = req.body;

  const userIndex = users.findIndex(u => u.id === parseInt(id));

  if (userIndex === -1) {
    return res.status(404).json({
      success: false,
      message: `Пользователь с ID ${id} не найден`
    });
  }

  // Обновление данных
  if (name) users[userIndex].name = name;
  if (email) users[userIndex].email = email;
  if (role) users[userIndex].role = role;

  res.json({
    success: true,
    message: 'Пользователь обновлен',
    data: users[userIndex]
  });
};

// Удалить пользователя
exports.deleteUser = (req, res) => {
  const { id } = req.params;
  const userIndex = users.findIndex(u => u.id === parseInt(id));

  if (userIndex === -1) {
    return res.status(404).json({
      success: false,
      message: `Пользователь с ID ${id} не найден`
    });
  }

  const deletedUser = users.splice(userIndex, 1)[0];

  res.json({
    success: true,
    message: 'Пользователь удален',
    data: deletedUser
  });
};