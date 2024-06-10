const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
dotenv.config()
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000
const app = express()
let jwt = require('jsonwebtoken');
// console.log(process.env.STRIPE_SECRET_KEY)


app.use(cors());
app.use(express.json());



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.x3wylq5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {


    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection

        const userCollection = client.db("nextHomeDB").collection("users");
        const propertiesCollection = client.db("nextHomeDB").collection("properties");
        const advertiserCollection = client.db("nextHomeDB").collection("advertise");
        const wishlistCollection = client.db("nextHomeDB").collection("wishList");
        const reviewerCollection = client.db("nextHomeDB").collection("reviews");
        const offersCollection = client.db("nextHomeDB").collection("offers");
        const paymentCollection = client.db("nextHomeDB").collection("payment");

        //jwt related api
        app.post('/jwt', async (req, res) => {
            let user = req.body;
            let token = jwt.sign(user, process.env.TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token })
        })

        // middlewares verify token
        const verifyToken = (req, res, next) => {
            const token = req.headers.authorization;
            console.log("inside verify->", token);
            if (!token) {
                return res.status(401).send({ message: "forbidden access" });
            }
            jwt.verify(token, process.env.TOKEN_SECRET, (error, decoded) => {
                if (error) {
                    console.log(error)
                    return res.status(401).send({ message: "forbidden access" });
                }

                req.decoded = decoded;
                next();
            })
        }

        const verifyAgent = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === "agent" || user?.role === "fraud";
            if (!isAdmin) {
                return res.status(403).send({ message: "forbidden access" });
            }
            next();
        }


        // middleware verify Admin
        const verifyAdmin = async (req, res, next) =>{
            const email = req.decoded.email;
            const query = {email: email};
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === "admin";
            if (!isAdmin){
              return res.status(403).send({message: "forbidden access"});
            }
            next();
          }
      


        // users related api
        app.get('/users', async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });

        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            res.send(user);
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists', insertedId: null })
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        app.put('/userRole/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const user = req.body;
            const updatedUser = { $set: { role: user.role } };
            const result = await userCollection.updateOne(query, updatedUser);
            res.send(result);
        })

        app.delete('/deleteUser/:id', verifyToken, verifyAdmin, async (req, res) =>{
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })

        // Properties related api
        app.post('/properties', async (req, res) => {
            const property = req.body;
            const result = await propertiesCollection.insertOne(property);
            res.send(result);
        })

        app.get('/properties', async (req, res) => {
            const properties = await propertiesCollection.find().toArray();
            res.send(properties);
        })

        app.get('/properties/:email', async (req, res) => {
            const email = req.params.email;
            const query = { agentEmail: email };
            const properties = await propertiesCollection.find(query).toArray();
            res.send(properties);
        })

        app.get('/getProperties/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const query = { _id: new ObjectId(id) };
            // console.log(query);
            const result = await propertiesCollection.findOne(query);
            console.log(result);
            res.send(result);
        })

        app.get('/verifiedProperties', async (req, res) => {
            // const properties = await propertiesCollection.find({ verificationStatus: 'verified' }).toArray();
            // // console.log(properties);
            // const result = [];
            // for (let i = 0; i < properties.length; i++) {
            //     const query = { email: properties[i].agentEmail };
            //     const user = await userCollection.findOne(query);
            //     // console.log(user);
            //     if (user && user?.role === 'agent') {
            //         result.push(properties[i]);
            //     }
            // }
            // // console.log(result);    
            // res.send(result);
            const agents = await userCollection.find({ role: 'agent' }).toArray();
            const agentEmails = agents.map(agent => agent.email);
    
            // Fetch all verified properties
            const properties = await propertiesCollection.find({ verificationStatus: 'verified' }).toArray();
    
            // Filter properties to include only those whose agent is in the agentEmails list
            const verifiedProperties = properties.filter(property => agentEmails.includes(property.agentEmail));
    
            res.send(verifiedProperties);
        })

        app.get('/advertisedProperties', verifyToken, async (req, res) => {
            // const token = req.headers.authorization;
            // console.log("inside advertisement", token);
            const properties = await propertiesCollection.find({ verificationStatus: 'verified' }).toArray();
            // console.log(properties);
            const result = [];
            for (let i = 0; i < properties.length; i++) {
                const query = { email: properties[i].agentEmail };
                const user = await userCollection.findOne(query);
                // console.log(user);
                if (user && user?.role === 'agent' && properties[i]?.isAdvertised === true) {
                    result.push(properties[i]);
                }
            }
            // console.log(result);    
            res.send(result);
        })

        app.delete('/properties/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await propertiesCollection.deleteOne(query);
            res.send(result);
        })

        app.put('/properties/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const property = req.body;
            const updatedProperties = {
                $set: {
                    propertyTitle: property.propertyTitle,
                    propertyLocation: property.propertyLocation,
                    propertyImageUrl: property.propertyImageUrl,
                    minPrice: property.minPrice,
                    maxPrice: property.maxPrice,
                }
            }
            const result = await propertiesCollection.updateOne(query, updatedProperties);
            res.send(result);
        })

        app.put('/verifiedProperties/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const property = req.body;
            const updatedProperties = {
                $set: {
                    verificationStatus: property.verificationStatus,
                }
            }
            const result = await propertiesCollection.updateOne(query, updatedProperties);
            res.send(result);
        })

        app.put('/advertise/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const property = req.body;
            const options = { upsert: true };
            const updatedProperties = {
                $set: {
                    isAdvertised: property.isAdvertised,
                }
            }
            const result = await propertiesCollection.updateOne(query, updatedProperties, options);
            res.send(result);
        })


        // Wishlist
        app.post('/wishlist', async (req, res) => {
            const wishlist = req.body;
            const result = await wishlistCollection.insertOne(wishlist);
            res.send(result);
        })

        app.get('/userWishList/:email', async (req, res) => {
            const email = req.params.email;
            const query = { buyerEmail: email };
            const wishlist = await wishlistCollection.find(query).toArray();
            res.send(wishlist);
        })

        app.get('/wishList/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const wishlist = await wishlistCollection.findOne(query);
            res.send(wishlist);
        })

        app.delete('/wishList/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await wishlistCollection.deleteOne(query);
            res.send(result);
        })

        // Review 
        app.post('/reviews', async (req, res) => {
            const review = req.body;
            const result = await reviewerCollection.insertOne(review);
            res.send(result);
        })

        app.get('/reviews/:id', async (req, res) => {
            const id = req.params.id;
            const query = { propertyId: id };
            const reviews = await reviewerCollection.find(query).toArray();
            res.send(reviews);
        })

        app.get('/reviews', async (req, res) => {
            const reviews = await reviewerCollection.find().toArray();
            res.send(reviews);
        })

        app.get('/myReviews/:email', async (req, res) => {
            const email = req.params.email;
            const query = { reviewerEmail: email };
            const reviews = await reviewerCollection.find(query).toArray();
            res.send(reviews);
        })

        app.delete('/deleteReviews/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await reviewerCollection.deleteOne(query);
            res.send(result);
        })

        // offers
        app.post('/offers', async (req, res) => {
            const offer = req.body;
            const result = await offersCollection.insertOne(offer);
            res.send(result);
        })

        app.get('/acceptOffer/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await offersCollection.findOne(query);
            res.send(result);
        })



        app.get('/offerList/:email', async (req, res) => {
            const email = req.params.email;
            const query = { buyerEmail: email };
            const offers = await offersCollection.find(query).toArray();
            res.send(offers);
        })

        app.get('/agentOfferList/:email', async (req, res) => {
            const email = req.params.email;
            const query = { agentEmail: email };
            const offers = await offersCollection.find(query).toArray();
            res.send(offers);
        })


        app.put('/rejectOffer/:propertyId', async (req, res) => {
            const propertyId = req.params.propertyId;
            const query = {
                propertyId: propertyId,
                status: 'pending'
            };
            const offer = req.body;
            const updatedOffers = {
                $set: {
                    status: offer.status,
                }
            }
            const result = await offersCollection.updateMany(query, updatedOffers);
            res.send(result);
        })

        app.put('/acceptOffer/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const offer = req.body;
            const updatedOffers = {
                $set: {
                    status: offer.status,
                }
            }
            const result = await offersCollection.updateOne(query, updatedOffers);
            res.send(result);
        })

        app.put('/rejectOneOffer/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const offer = req.body;
            const updatedOffers = {
                $set: {
                    status: offer.status,
                }
            }
            const result = await offersCollection.updateOne(query, updatedOffers);
            res.send(result);
        })


        app.put('/addTransactionId/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const offer = req.body;
            const updatedOffers = {
                $set: {
                    transactionId: offer.transactionId,
                    status: offer.status,
                }
            }
            const options = {
                upsert: true
            };

            const result = await offersCollection.updateOne(query, updatedOffers, options);
            res.send(result);
        })

        // Payment
        app.post("/create_payment_intent", async (req, res) => {
            const { price } = req.body;
            // console.log(price);
            const amount = parseInt(price * 100);
            // console.log("what is the amount");

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"]
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        app.post('/payment', async (req, res) => {
            const payment = req.body;
            const result = await paymentCollection.insertOne(payment);
            res.send(result);
        })

        app.get('/soldProperties/:email', async (req, res) => {
            const email = req.params.email;
            const query = { agentEmail: email };
            const soldProperties = await paymentCollection.find(query).toArray();
            res.send(soldProperties);
        })



        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('NextHome is running...........');
})


app.listen(port, () => {
    console.log(`NextHome is running on port ${port}`);
})