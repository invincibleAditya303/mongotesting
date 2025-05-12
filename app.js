const express = require('express')
const app = express()
const cors = require('cors')
const PORT = process.env.PORT || 3000

app.use(express.json())

app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}))

require('dotenv').config()
const cloudinary = require('cloudinary').v2

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET
})

const multer = require('multer')
const {CloudinaryStorage} = require('multer-storage-cloudinary')
const {MongoClient, ObjectId} = require('mongodb')

const uri = 'mongodb+srv://ammuaditya303:j95fCqhpotEWXqqf@cluster0.67stb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'
const client = new MongoClient(uri)

const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'categories',
    allowed_formats: ['jpg', 'jpeg', 'png']
  }
})

const upload = multer({storage: storage})

//connecting to the server
const connectToSever = async () => {
  try {
    await client.connect()
    console.log('Connected to MongoDB')
  } catch (error) {
    console.log(`Connection failed: ${error}`)
  }
}

connectToSever()

//listening on the port
app.listen(PORT, () => {
  console.log('Server listening on http://localhost:3000')
})

const db = client.db('categoriesAssignment')


//Add user API
app.post('/register', async (request, response) => {
  const {username, name, password, gender} = request.body

  const hashedPassword = await bcrypt.hash(password, 10)

  const existingUser = await db.collection('userDetails').findOne({username})
  

  if (!existingUser) {
    if (password.length >= 5) {
      await db.collection('userDetails').insertOne({
        username: `${username}`,
        password: `${hashedPassword}`,
        name: `${name}`,
        gender: `${gender}`
      })
      response.status(200)
      response.json('User created Successfully')
    } else {
      response.status(400)
      response.json('Password too short')
    }
  } else {
    response.status(400)
    response.json('User already exists')
  }
})

//Login User API
app.post('/login', async (request, response) => {
  const {username, password} = request.body

  const getUserDocoument = await db.collection('userDetails').findOne({username})
  
  if (getUserDocoument) {
    isPasswordMatched = await bcrypt.compare(password, getUserDocoument.password)

    if (isPasswordMatched) {
      const payload = {
        id: getUserDocoument.id,
        username: getUserDocoument.username,
        name: getUserDocoument.name,
        gender: getUserDocoument.gender
      }

      const jwtToken = jwt.sign(payload, 'categories', {expiresIn: '30days'})
      response.json(jwtToken)
    } else {
      response.status(401)
      response.json('Invalid Password')
    }
  } else {
    response.status(401)
    response.json("User doesn't exist")
  }
})

//Middleware Function
const authenticationToken = async (request,response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }

  if (jwtToken === undefined) {
    response.status(401)
    response.json('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'categories', async (error, payload) => {
      if (error) {
        response.status(401)
        response.json('Invalid JWT Token')
      } else {
        request.payload = payload
        next()
      }
    })
  }
}

//GET all categories API
app.get('/categories', authenticationToken, async (request, response) => {
  const categories = await db.collection('categories').find({}).toArray()
  response.json(categories)
})

//Add New category API
app.post('/categories', authenticationToken, upload.single('categoryImage'), async(request, response) => {
  const {categoryName, itemCount} = request.body
  const categoryImage = request.file.path
  const existingCategory = await db.collection('categories').findOne({category_name: `${categoryName}`})

  if (!existingCategory) {
    await db.collection('categories').insertOne({
      category_name: `${categoryName}`,
      item_count: itemCount,
      category_image: `${categoryImage}`
    })
    response.status(200)
    response.json('Category successfully added')
  } else {
    response.status(400)
    response.json('Category already exists')
  }
})

//Update Existing category API
app.put('/categories/:categoryId', authenticationToken, upload.single('categoryImage'), async (request, response) => {
  const {categoryId} = request.params
  const id = new ObjectId(categoryId)

  const category = await db.collection('categories').findOne({_id: id})

  if (category !== undefined) {
    const {
      categoryName = category.category_name,
      itemCount = category.item_count,
    } = request.body

    let categoryImage = category.category_image

    if (request.file) {
      try {
        cloudinary.uploader.destroy(category.category_image, { invalidate: true })
        const result = await cloudinary.uploader.upload(request.file.path)
        categoryImage = result.secure_url
        console.log(typeof(categoryImage))
      } catch (error) {
          return response.status(500).json({ error: error.message });
      }
    }

    await db.collection('categories').updateOne({_id: id}, {$set: {category_name: `${categoryName}`, category_image: `${categoryImage}`, item_count: itemCount}})
    response.status(200)
    response.json(`Category updated successfully`, categoryImage)
  } else {
    response.status(400)
    response.json('Category not found')
  }
})