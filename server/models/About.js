const mongoose = require('mongoose');

const aboutSchema = new mongoose.Schema(
  {
    imageUrl: {
      type: String,
      default: '/img/About/About.jpeg',
      trim: true,
      required: [true, 'About page image URL is required'],
    },
    altText: {
      type: String,
      default: 'VASHTRAM Textile Weaving and Heritage',
      trim: true,
    },
    heading: {
      type: String,
      default: 'Crafting What Gives You Comfort,Every good day begins with a good night’s sleep.',
      trim: true,
    },
    subheading: {
      type: String,
      default:
        'Your bed is more than a piece of furniture. It is where you rest after a long day, spend time with your family, recharge, and begin each new morning. We believe something this important deserves thoughtful luxury.',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Helper static method to get or create the singleton About document
aboutSchema.statics.getSingleton = async function () {
  let about = await this.findOne();
  if (!about) {
    about = await this.create({
      imageUrl: '/img/About/About.jpeg',
      altText: 'VASHTRAM Textile Weaving and Heritage',
    });
  }
  return about;
};

module.exports = mongoose.model('About', aboutSchema);
