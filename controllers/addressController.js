
const User = require('../models/User');

const addAddress = async (req, res) => {
  try {
    const {
      fullName,
      phone,
      house,
      street,
      city,
      state,
      pincode,
      landmark,
      addressType
    } = req.body;

    // Required field validation
    if (
      !fullName?.trim() ||
      !phone?.trim() ||
      !house?.trim() ||
      !street?.trim() ||
      !city?.trim() ||
      !state?.trim() ||
      !pincode?.trim()
    ) {
      return res.redirect('/addresses/new?error=required');
    }

    const cleanName = fullName.trim();
    const cleanPhone = phone.trim();
    const cleanPincode = pincode.trim();

    // Name validation
    if (!/^[A-Za-z ]{3,}$/.test(cleanName)) {
      return res.redirect('/addresses/new?error=name');
    }

    // Indian phone validation
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return res.redirect('/addresses/new?error=phone');
    }

    // Indian PIN code validation
    if (!/^[1-9]\d{5}$/.test(cleanPincode)) {
      return res.redirect('/addresses/new?error=pincode');
    }

    // Address type validation
    const validTypes = ['Home', 'Work', 'Other'];

    if (addressType && !validTypes.includes(addressType)) {
      return res.redirect('/addresses/new?error=type');
    }

    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.redirect('/login');
    }

    // First address becomes default
    const isDefault = user.addresses.length === 0;

    user.addresses.push({
      fullName: cleanName,
      phone: cleanPhone,
      house: house.trim(),
      street: street.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: cleanPincode,
      landmark: landmark?.trim() || '',
      addressType: addressType || 'Home',
      isDefault
    });

    await user.save();

    return res.redirect('/addresses');

  } catch (error) {
    console.error('Add address error:', error);
    return res.redirect('/addresses/new?error=server');
  }
};


const editAddress = async (req, res) => {
  try {
    const {
      fullName,
      phone,
      house,
      street,
      city,
      state,
      pincode,
      landmark,
      addressType,
      isDefault
    } = req.body;

    // Validate required fields
    if (
      !fullName?.trim() ||
      !phone?.trim() ||
      !house?.trim() ||
      !street?.trim() ||
      !city?.trim() ||
      !state?.trim() ||
      !pincode?.trim()
    ) {
      return res.redirect(`/addresses/${req.params.id}/edit`);
    }

    // Validate phone and PIN code
    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      return res.redirect(`/addresses/${req.params.id}/edit`);
    }

    if (!/^[1-9]\d{5}$/.test(pincode.trim())) {
      return res.redirect(`/addresses/${req.params.id}/edit`);
    }

    if (!['Home', 'Work', 'Other'].includes(addressType)) {
      return res.redirect(`/addresses/${req.params.id}/edit`);
    }

    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.redirect('/login');
    }

    const address = user.addresses.id(req.params.id);

    if (!address) {
      return res.redirect('/addresses');
    }

    // Update address fields
    address.fullName = fullName.trim();
    address.phone = phone.trim();
    address.house = house.trim();
    address.street = street.trim();
    address.city = city.trim();
    address.state = state.trim();
    address.pincode = pincode.trim();
    address.landmark = landmark?.trim() || '';
    address.addressType = addressType;

    // Set as default if checkbox is selected
    if (isDefault === 'true') {
      user.addresses.forEach(item => {
        item.isDefault = false;
      });

      address.isDefault = true;
    }

    await user.save();

    return res.redirect('/addresses');

  } catch (error) {
    console.error('Edit address error:', error);
    return res.redirect('/addresses');
  }
};

const deleteAddress = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.redirect('/login');
    }

    const address = user.addresses.id(req.params.id);

    if (!address) {
      return res.redirect('/addresses');
    }

    const wasDefault = address.isDefault;

    // Remove the selected address
    user.addresses.pull({ _id: req.params.id });

    // Assign default to another address if needed
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    return res.redirect('/addresses');

  } catch (error) {
    console.error('Delete address error:', error);
    return res.redirect('/addresses');
  }
};

const setDefaultAddress = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.redirect('/login');
    }

    const selectedAddress = user.addresses.id(req.params.id);

    if (!selectedAddress) {
      return res.redirect('/addresses');
    }

    // Remove default status from all addresses
    user.addresses.forEach(address => {
      address.isDefault = false;
    });

    // Set selected address as default
    selectedAddress.isDefault = true;

    await user.save();

    return res.redirect('/addresses');

  } catch (error) {
    console.error('Set default address error:', error);
    return res.redirect('/addresses');
  }
};
module.exports = {
  addAddress,
  editAddress,
  deleteAddress,
  setDefaultAddress
};