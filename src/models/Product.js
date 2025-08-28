const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  },
  stock: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  categoryId: {
    type: DataTypes.INTEGER,
    references: {
      model: 'categories',
      key: 'id'
    }
  },
  image: {
    type: DataTypes.STRING,
    allowNull: true
  },
  sku: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  weight: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  dimensions: {
    type: DataTypes.JSON,
    allowNull: true
  },
  featured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  tableName: 'products',
  timestamps: true,
  indexes: [
    {
      fields: ['categoryId']
    },
    {
      fields: ['sku']
    },
    {
      fields: ['price']
    },
    {
      fields: ['createdAt']
    }
  ]
});

// Associations will be defined in models/index.js
module.exports = Product;