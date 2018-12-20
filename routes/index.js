var express = require('express');
var router = express.Router();
var fs = require('fs');


router.get('/travel',function(req,res,next){
    res.render('travel',{})
});
router.get('/',function(req,res,next){
    res.render('household',{})
});

module.exports = router;
