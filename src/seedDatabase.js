require('dotenv').config();
const { sequelize } = require('./config/database');
const { Product, Category, User, Review } = require('./models');
const bcrypt = require('bcrypt');

const categories = [
  { name: 'Electronics', description: 'Electronic devices and accessories' },
  { name: 'Home', description: 'Home and kitchen appliances' },
  { name: 'Fitness', description: 'Sports and fitness equipment' },
  { name: 'Accessories', description: 'Fashion and tech accessories' }
];

const products = [
  {
    name: "Wireless Headphones",
    description: "Premium noise-cancelling wireless headphones with 30-hour battery life",
    price: 299.99,
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500",
    stock: 50,
    sku: 'WH-001',
    categoryName: 'Electronics'
  },
  {
    name: "Smart Watch",
    description: "Fitness tracking smartwatch with heart rate monitor and GPS",
    price: 399.99,
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500",
    stock: 30,
    sku: 'SW-001',
    categoryName: 'Electronics'
  },
  {
    name: "Laptop Backpack",
    description: "Water-resistant laptop backpack with USB charging port",
    price: 79.99,
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500",
    stock: 100,
    sku: 'LB-001',
    categoryName: 'Accessories'
  },
  {
    name: "Mechanical Keyboard",
    description: "RGB mechanical gaming keyboard with Cherry MX switches",
    price: 149.99,
    image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500",
    stock: 25,
    sku: 'KB-001',
    categoryName: 'Electronics'
  },
  {
    name: "Portable Speaker",
    description: "Waterproof Bluetooth speaker with 360° sound",
    price: 89.99,
    image: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500",
    stock: 75,
    sku: 'PS-001',
    categoryName: 'Electronics'
  },
  {
    name: "Coffee Maker",
    description: "Programmable coffee maker with thermal carafe",
    price: 129.99,
    image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500",
    stock: 40,
    sku: 'CM-001',
    categoryName: 'Home'
  },
  {
    name: "Yoga Mat",
    description: "Non-slip exercise yoga mat with carrying strap",
    price: 39.99,
    image: "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500",
    stock: 60,
    sku: 'YM-001',
    categoryName: 'Fitness'
  },
  {
    name: "Desk Lamp",
    description: "LED desk lamp with adjustable brightness and color temperature",
    price: 59.99,
    image: "https://images.unsplash.com/photo-1565636192335-6ecd63e18999?w=500",
    stock: 35,
    sku: 'DL-001',
    categoryName: 'Home'
  },
  {
    name: "Running Shoes",
    description: "Lightweight running shoes with responsive cushioning",
    price: 119.99,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500",
    stock: 45,
    sku: 'RS-001',
    categoryName: 'Fitness'
  },
  {
    name: "Tablet Stand",
    description: "Adjustable aluminum tablet stand for desk",
    price: 29.99,
    image: "https://images.unsplash.com/photo-1585792180666-f7347c490ee2?w=500",
    stock: 80,
    sku: 'TS-001',
    categoryName: 'Accessories'
  }
];

const users = [
  {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'password123'
  },
  {
    name: 'Jane Smith',
    email: 'jane@example.com',
    password: 'password123'
  },
  {
    name: 'Bob Johnson',
    email: 'bob@example.com',
    password: 'password123'
  }
];

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seed...');
    
    // Clear existing data
    await sequelize.sync({ force: true });
    console.log('📦 Database cleared');
    
    // Create categories
    const categoryMap = {};
    for (const cat of categories) {
      const created = await Category.create(cat);
      categoryMap[cat.name] = created.id;
    }
    console.log('✅ Categories created');
    
    // Create users
    const userList = [];
    for (const userData of users) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const user = await User.create({
        ...userData,
        password: hashedPassword
      });
      userList.push(user);
    }
    console.log('✅ Users created');
    
    // Create products
    const productList = [];
    for (const prod of products) {
      const { categoryName, ...productData } = prod;
      const product = await Product.create({
        ...productData,
        categoryId: categoryMap[categoryName]
      });
      productList.push(product);
    }
    console.log('✅ Products created');
    
    // Create some reviews
    const reviewTexts = [
      'Great product! Highly recommended.',
      'Good value for money.',
      'Excellent quality and fast shipping.',
      'Works as expected.',
      'Amazing! Exceeded my expectations.'
    ];
    
    for (let i = 0; i < 20; i++) {
      await Review.create({
        productId: productList[Math.floor(Math.random() * productList.length)].id,
        userId: userList[Math.floor(Math.random() * userList.length)].id,
        rating: 3 + Math.floor(Math.random() * 3), // 3-5 stars
        comment: reviewTexts[Math.floor(Math.random() * reviewTexts.length)]
      });
    }
    console.log('✅ Reviews created');
    
    console.log('🎉 Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;