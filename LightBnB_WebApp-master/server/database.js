const properties = require('./json/properties.json');
const users = require('./json/users.json');
const { Pool } = require('pg');

// Connect to the LightBnB database
const pool = new Pool({
  user: 'vagrant',
  host: 'localhost',
  password: '123',
  database: 'lightbnb'
})

/// Users

/**
 * Get a single user from the database given their email.
 * @param {String} email The email of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithEmail = function(email) {
  return pool.query(`
    SELECT *
    FROM users
    WHERE email = $1;
    `, [email])
    .then(res => {
      return (res.rowCount > 0) ? res.rows[0] : null;
    })
    .catch ((err) => {
      console.log("query error", err.stack)
    });
}
exports.getUserWithEmail = getUserWithEmail;

/**
 * Get a single user from the database given their id.
 * @param {string} id The id of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithId = function(id) {
  return pool.query(`
    SELECT *
    FROM users
    WHERE id = $1;
    `, [id])
    .then(res => {
      return (res.rowCount > 0) ? res.rows[0] : null;
    })
    .catch((err) => {
      console.log("query error", err.stack)
    });
}
exports.getUserWithId = getUserWithId;


/**
 * Add a new user to the database.
 * @param {{name: string, password: string, email: string}} user
 * @return {Promise<{}>} A promise to the user.
 */
const addUser =  function(user) {
  return pool.query(`
  INSERT into users (name,email,password) VALUES ($1,$2,$3) RETURNING *;`, [user.name, user.email, user.password])
    .then(res => {
      return res.rows[0] 
    })
    .catch(err => {
      console.log("query error", err.stack);
    })
}
exports.addUser = addUser;

/// Reservations

/**
 * Get all reservations for a single user.
 * @param {string} guest_id The id of the user.
 * @return {Promise<[{}]>} A promise to the reservations.
 */
const getAllReservations = function(guest_id, limit = 10) {
  return pool.query(`
    SELECT reservations.*, properties.*, avg(rating) as average_rating 
    FROM reservations 
    JOIN properties ON properties.id = reservations.property_id
    JOIN property_reviews ON properties.id = property_reviews.property_id
    WHERE reservations.guest_id = $1 AND end_date < now()::date
    GROUP BY reservations.id, properties.id
    ORDER BY start_date
    LIMIT $2;
  `, [guest_id, limit])
  .then(res => res.rows)
  .catch (err => console.log("query error", err.stack));
}
exports.getAllReservations = getAllReservations;

/// Properties

/**
 * Get all properties.
 * @param {{}} options An object containing query options.
 * @param {*} limit The number of results to return.
 * @return {Promise<[{}]>}  A promise to the properties.
 */
const getAllProperties = function(options, limit = 10) {

  //check if options is empty
  const hasOptions = Object.values(options).some(elm => elm);
  
  const queryParams = [];

  let queryString = `
  SELECT properties.*, avg(property_reviews.rating) as average_rating
  FROM properties
  JOIN property_reviews ON properties.id = property_id
  `;
  
  if (hasOptions) {
    let minimum = (options.minimum_price_per_night) ? Number(options.minimum_price_per_night) * 100 : 0;
    let maximum = (options.maximum_price_per_night) ? Number(options.maximum_price_per_night) * 100 : 0;
    
    queryString += `WHERE `;
    
    if (options.city) {
      queryParams.push(`%${options.city.substr(1)}%`);
      queryString += `city LIKE $${queryParams.length}`;
    }

    if (options.owner_id) {
      if (queryParams.length === 1) { //case city was already pushed
        queryString += ` AND `;
      }
      queryParams.push(options.owner_id);
      queryString += `owner_id = $${queryParams.length}`;
    }

    if (minimum || maximum) {
      if (queryParams.length >= 1) { //case city and/or owner_id were already pushed
        queryString += ` AND `
      }
      
      if (minimum && (maximum === 0)) {
        queryParams.push(minimum)
        queryString += `cost_per_night >= $${queryParams.length}`;
      } else if (maximum && (minimum === 0)) {
        queryParams.push(maximum)
        queryString += `cost_per_night <= $${queryParams.length}`;
      } else {
        queryParams.push(minimum)
        queryParams.push(maximum)
        queryString += `cost_per_night >= $${queryParams.length - 1} AND cost_per_night <= $${queryParams.length}`;
      }
    }

    if (options.minimum_rating) {
      if (queryParams.length >= 1) { //case 1 or more options were already pushed
        queryString += ` AND `
      }
      queryParams.push(options.minimum_rating);
      queryString += `rating >= $${queryParams.length}`
    }
  }
  queryParams.push(limit);
  queryString += `
  GROUP BY properties.id
  ORDER BY cost_per_night
  LIMIT $${queryParams.length};
  `;

  return pool.query(queryString, queryParams)
    .then(res => {
      console.log(res.rows)
      return res.rows
    });
};
exports.getAllProperties = getAllProperties;


/**
 * Add a property to the database
 * @param {{}} property An object containing all of the property details.
 * @return {Promise<{}>} A promise to the property.
 */
const addProperty = function(property) {
  const propertyId = Object.keys(properties).length + 1;
  property.id = propertyId;
  properties[propertyId] = property;
  return Promise.resolve(property);
}
exports.addProperty = addProperty;
