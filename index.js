const express = require('express')

const app = express()

app.listen(3000, (req, res)=>{
    console.log('app is running at port number 3000')
})