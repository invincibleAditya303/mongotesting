const express = require('express')
const app = express()
const cors = require('cors')
const PORT = process.env.PORT || 3000

app.use(express.json())

app.use(cors({
  origin: 'http://localhost:3000', // your frontend origin
  credentials: true // if you're using cookies
}))

require('dotenv').config()

const {MongoClient} = require('mongodb')

const uri = 'mongodb+srv://ammuaditya303:j95fCqhpotEWXqqf@cluster0.67stb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'
const client = new MongoClient(uri)

const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

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
      response.send('User created Successfully')
    } else {
      response.status(400)
      response.send('Password too short')
    }
  } else {
    response.status(400)
    response.send('User already exists')
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
      response.send('Invalid Password')
    }
  } else {
    response.status(401)
    response.send("User doesn't exist")
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
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'categories', async (error, payload) => {
      if (error) {
        response.status(401)
        response.status('Invalid JWT Token')
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
  response.send(categories)
})

//Add New category API
app.post('/categories', authenticationToken, async(request, response) => {
  const {categoryName, itemCount, categoryImage} = request.body
  const existingCategory = await db.collection('categories').findOne({category_name: `${categoryName}`})

  if (!existingCategory) {
    await db.collection('categories').insertOne({
      category_name: `${categoryName}`,
      item_count: itemCount,
      category_image: `${categoryImage}`
    })
    response.status(200)
    response.send('Category successfully added')
  } else {
    response.status(400)
    response.send('Category already exists')
  }
})