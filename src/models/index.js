const Product = require('./Product');
const Category = require('./Category');
const Review = require('./Review');
const User = require('./User');

// Define associations
Product.belongsTo(Category, { foreignKey: 'categoryId' });
Category.hasMany(Product, { foreignKey: 'categoryId' });

Product.hasMany(Review, { foreignKey: 'productId' });
Review.belongsTo(Product, { foreignKey: 'productId' });

Review.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Review, { foreignKey: 'userId' });

module.exports = {
  Product,
  Category,
  Review,
  User
};