class MessageConstructor {
  constructor() {
  }

  createMessageForRottenTomatoes(responseObj) {
    if (responseObj["likes"] === "") {
      return `I am sorry i am unable to find the movie rating on rotten tomatoes please go to 
      https://www.rottentomatoes.com/search/?search=${responseObj["title"]}`;

    }
    else {
      return `${responseObj["rating"]} and ${responseObj["likes"]} people 
      like it on rottenTomatoes`

    }

  }

  createMessageForIMDB(responseObj) {
    if (responseObj["rating"] === "") {
      return `I am sorry i am unable to find the movie rating on rotten tomatoes please go to 
      https://www.imdb.com/find?ref_=nv_sr_fn&q=${responseObj["title"]}&s=all`;
    }
    else {
      return `*Rating:*</b>${responseObj["rating"]} \n\n\n <b> Cast:</b> ${responseObj["actors"]}  \n\n\n 
<b>Plot:</b>${responseObj["summary"]}\n\n \n`
    }

  }

  createMessage(response) {
    return `${this.createMessageForIMDB(response["imdb"])}`
  }


}

module.exports = new MessageConstructor();