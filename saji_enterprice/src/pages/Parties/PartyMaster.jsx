import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../components/ui/table';
import { Plus, Edit, Trash2, Search, Users, Building, DollarSign, CreditCard } from 'lucide-react';
import db from '../../utils/database';
import showToast from '../../utils/toast';
import ConfirmDialog from '../../components/ui/confirm-dialog';

const PartyMaster = () => {
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingParty, setEditingParty] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [partiesPerPage] = useState(10);
  
  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [partyToDelete, setPartyToDelete] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    gst_number: '',
    opening_balance: '',
    min_due_days: '30'
  });

  useEffect(() => {
    loadParties();
  }, []);

  const loadParties = async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading parties with real-time balance calculation...');
      const data = await db.getParties();
      console.log('✅ Loaded parties with real-time balances:', data);
      console.log('📊 Number of parties loaded:', data.length);
      
      // Log balance details for debugging
      data.forEach(party => {
        console.log(`👤 ${party.name}: Opening ₹${party.opening_balance} → Current ₹${party.current_balance?.toFixed(2) || '0.00'}`);
      });
      
      // Force component re-render by creating new array
      setParties([...data]);
    } catch (error) {
      console.error('❌ Error loading parties:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Add specific logging for min_due_days changes
    if (name === 'min_due_days') {
      console.log('🔍 min_due_days input change:', value);
      console.log('🔍 Previous formData.min_due_days:', formData.min_due_days);
    }
    
    setFormData(prev => ({ 
      ...prev, 
      [name]: value 
    }));
    
    if (name === 'min_due_days') {
      console.log('🔍 Updated formData will have min_due_days:', value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Parse min_due_days with explicit handling for valid values
      const minDueDays = formData.min_due_days && formData.min_due_days.trim() !== '' 
        ? parseInt(formData.min_due_days) 
        : 30;
      
      console.log('🔍 Form submission - min_due_days input:', formData.min_due_days);
      console.log('🔍 Form submission - parsed min_due_days:', minDueDays);
      
      const partyData = {
        ...formData,
        party_type: 'both', // Default to both since we removed party type selection
        balance_type: 'debit', // Default balance type
        opening_balance: parseFloat(formData.opening_balance) || 0,
        min_due_days: minDueDays
      };

      if (editingParty) {
        partyData.party_id = editingParty.party_id;
        console.log('Updating party with data:', partyData);
      } else {
        console.log('Creating new party with data:', partyData);
      }

      const result = await db.saveParty(partyData);
      console.log('Save result:', result);
      
      // Force reload the parties data
      console.log('Reloading parties data...');
      
      // Clear current state and reload
      setParties([]);
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
      await loadParties();
      
      // Verify the data was updated by checking the specific party
      if (editingParty) {
        const updatedParty = await db.getPartyById(editingParty.party_id);
        console.log('Updated party from database:', updatedParty);
      }
      
      // Reset form and show toast notification
      resetForm();
      showToast.success(editingParty ? 'Party updated successfully!' : 'Party created successfully!');
    } catch (error) {
      console.error('Error saving party:', error);
      showToast.error('Error saving party: ' + error.message);
    }
  };

  const handleEdit = (party) => {
    console.log('🔍 Editing party - original min_due_days:', party.min_due_days);
    
    const minDueDaysValue = party.min_due_days !== null && party.min_due_days !== undefined 
      ? party.min_due_days.toString() 
      : '30';
    
    console.log('🔍 Setting form min_due_days to:', minDueDaysValue);
    
    setEditingParty(party);
    setFormData({
      name: party.name || '',
      address: party.address || '',
      phone: party.phone || '',
      gst_number: party.gst_number || '',
      opening_balance: party.opening_balance || '',
      min_due_days: minDueDaysValue
    });
    setShowForm(true);
  };

  const handleDeleteClick = (partyId) => {
    setPartyToDelete(partyId);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!partyToDelete) return;
    
    try {
      await db.deleteParty(partyToDelete);
      await loadParties();
      showToast.success('Party deleted successfully!');
    } catch (error) {
      console.error('Error deleting party:', error);
      showToast.error('Error deleting party: ' + error.message);
    } finally {
      setPartyToDelete(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      phone: '',
      gst_number: '',
      opening_balance: '',
      min_due_days: '30'
    });
    setEditingParty(null);
    setShowForm(false);
    // Clear any search filters that might be hiding the updated data
    setSearchTerm('');
  };

  const filteredParties = parties.filter(party =>
    party.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    party.phone?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination calculations
  const indexOfLastParty = currentPage * partiesPerPage;
  const indexOfFirstParty = indexOfLastParty - partiesPerPage;
  const currentParties = filteredParties.slice(indexOfFirstParty, indexOfLastParty);
  const totalPages = Math.ceil(filteredParties.length / partiesPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Reset to first page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const getPartyTypeIcon = (type) => {
    switch (type) {
      case 'customer': return <Users className="w-4 h-4" />;
      case 'supplier': return <Building className="w-4 h-4" />;
      case 'both': return <div className="flex"><Users className="w-3 h-3" /><Building className="w-3 h-3" /></div>;
      default: return null;
    }
  };

  if (showForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Modern Header */}
          <div className="flex items-center justify-between bg-white rounded-2xl shadow-lg p-6 border-0">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-green-100 to-green-100">
                <Users className="w-8 h-8 text-fatima-green" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">
                  {editingParty ? 'Edit Party' : 'Add New Party'}
                </h1>
                <p className="text-gray-600 mt-1">
                  {editingParty ? 'Update party information' : 'Create a new customer or supplier'}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={resetForm}
              className="px-6 py-3 border-2 border-gray-300 hover:border-red-300 hover:text-red-600 transition-all duration-200"
            >
              Cancel
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information Section */}
            <Card className="shadow-xl border-0 bg-white rounded-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-fatima-green to-green-600 p-6">
                <CardTitle className="text-white text-xl font-bold flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Users className="w-5 h-5" />
                  </div>
                  Basic Information
                </CardTitle>
              </div>
              <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
                      Party Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-fatima-green focus:ring-4 focus:ring-blue-50 transition-all duration-200 font-medium"
                      placeholder="Enter party name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-fatima-green focus:ring-4 focus:ring-blue-50 transition-all duration-200 font-medium"
                      placeholder="Enter phone number"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
                      Address
                    </label>
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      rows={4}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-fatima-green focus:ring-4 focus:ring-blue-50 transition-all duration-200 font-medium resize-none"
                      placeholder="Enter complete address"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Business Information Section */}
            <Card className="shadow-xl border-0 bg-white rounded-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-fatima-green to-green-600 p-6">
                <CardTitle className="text-white text-xl font-bold flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Building className="w-5 h-5" />
                  </div>
                  Business Information
                </CardTitle>
              </div>
              <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
                      GST Number
                    </label>
                    <input
                      type="text"
                      name="gst_number"
                      value={formData.gst_number}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-fatima-green focus:ring-4 focus:ring-blue-50 transition-all duration-200 font-medium"
                      placeholder="Enter GST number"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
                      Opening Balance
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-3 text-gray-500 font-bold">₹</span>
                      <input
                        type="number"
                        name="opening_balance"
                        value={formData.opening_balance}
                        onChange={handleInputChange}
                        className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-fatima-green focus:ring-4 focus:ring-blue-50 transition-all duration-200 font-medium"
                        placeholder="0.00"
                        step="0.01"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
                      Payment Due Days
                    </label>
                    <input
                      type="number"
                      name="min_due_days"
                      value={formData.min_due_days}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-fatima-green focus:ring-4 focus:ring-blue-50 transition-all duration-200 font-medium"
                      placeholder="30"
                      min="1"
                      max="365"
                    />
                    <p className="text-xs text-gray-500">Days after which invoices become overdue</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-end gap-4 bg-white rounded-2xl shadow-lg p-6">
              <Button 
                type="button" 
                variant="outline" 
                onClick={resetForm}
                className="px-8 py-3 border-2 border-gray-300 hover:border-red-300 hover:text-red-600 transition-all duration-200 font-semibold"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="px-8 py-3 bg-gradient-to-r from-fatima-green to-green-600 hover:from-fatima-green hover:to-green-600 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                {editingParty ? 'Update Party' : 'Save Party'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Calculate summary statistics
  const totalParties = parties.length;
  const totalOutstanding = parties.reduce((sum, party) => sum + (party.current_balance || 0), 0);
  const positiveOutstanding = parties.reduce((sum, party) => sum + (party.current_balance > 0 ? party.current_balance : 0), 0);
  const negativeOutstanding = parties.reduce((sum, party) => sum + (party.current_balance < 0 ? Math.abs(party.current_balance) : 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Party Master</h1>
        <Button onClick={() => setShowForm(true)} className="bg-fatima-green hover:bg-fatima-green/90">
          <Plus className="w-4 h-4 mr-2" />
          Add Party
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-green-100">
              <Users className="w-6 h-6 text-fatima-green" />
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600">Total Parties</p>
              <p className="text-2xl font-bold text-gray-900">{totalParties}</p>
              <p className="text-xs text-gray-500 mt-1">Active customers & suppliers</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-green-100">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600">Total Outstanding</p>
              <p className="text-2xl font-bold text-gray-900">₹{Math.abs(totalOutstanding).toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">
                {totalOutstanding >= 0 ? 'Net receivable' : 'Net payable'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Party List</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <input
                type="text"
                placeholder="Search parties..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-input rounded-md w-full"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading parties...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>S.No</TableHead>
                  <TableHead>Party Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>GST Number</TableHead>
                  <TableHead>Opening Balance</TableHead>
                  <TableHead>Current Balance</TableHead>
                  <TableHead>Balance Type</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentParties.map((party, index) => (
                  <TableRow key={party.party_id}>
                    <TableCell className="font-medium">{indexOfFirstParty + index + 1}</TableCell>
                    <TableCell className="font-medium">{party.name}</TableCell>
                    <TableCell>{party.address || '-'}</TableCell>
                    <TableCell>{party.phone || '-'}</TableCell>
                    <TableCell>{party.gst_number || '-'}</TableCell>
                    <TableCell>₹{party.opening_balance || 0}</TableCell>
                    <TableCell>
                      <span className={party.current_balance > 0 ? 'text-green-600' : party.current_balance < 0 ? 'text-red-600' : 'text-gray-600'}>
                        ₹{Math.abs(party.current_balance || 0).toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="capitalize">
                      <span className={party.current_balance > 0 ? 'text-green-600' : party.current_balance < 0 ? 'text-red-600' : 'text-gray-600'}>
                        {party.current_balance > 0 ? 'Credit' : party.current_balance < 0 ? 'Debit' : 'Balanced'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(party)}
                          className="p-2 rounded-md transition-colors bg-fatima-green hover:bg-fatima-green/90 text-white flex items-center justify-center"
                          title="Edit Party"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(party.party_id)}
                          className="p-2 rounded-md transition-colors flex items-center justify-center"
                          style={{backgroundColor: '#ef4444', color: 'white'}}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#dc2626'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = '#ef4444'}
                          title="Delete Party"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {currentParties.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No parties found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {filteredParties.length > partiesPerPage && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-600">
                Showing {indexOfFirstParty + 1} to {Math.min(indexOfLastParty, filteredParties.length)} of {filteredParties.length} parties
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={prevPage}
                  disabled={currentPage === 1}
                  className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                <div className="flex space-x-1">
                  {/* First page */}
                  {currentPage > 3 && (
                    <>
                      <button
                        onClick={() => paginate(1)}
                        className="px-3 py-2 text-sm font-medium rounded-md text-gray-500 bg-white border border-gray-300 hover:bg-gray-50"
                      >
                        1
                      </button>
                      {currentPage > 4 && (
                        <span className="px-2 py-2 text-gray-500">...</span>
                      )}
                    </>
                  )}
                  
                  {/* Pages around current page */}
                  {[...Array(totalPages)].map((_, i) => {
                    const pageNum = i + 1;
                    if (pageNum >= currentPage - 2 && pageNum <= currentPage + 2) {
                      return (
                        <button
                          key={pageNum}
                          onClick={() => paginate(pageNum)}
                          className={`px-3 py-2 text-sm font-medium rounded-md ${
                            currentPage === pageNum
                              ? 'bg-fatima-green text-white'
                              : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    }
                    return null;
                  })}
                  
                  {/* Last page */}
                  {currentPage < totalPages - 2 && (
                    <>
                      {currentPage < totalPages - 3 && (
                        <span className="px-2 py-2 text-gray-500">...</span>
                      )}
                      <button
                        onClick={() => paginate(totalPages)}
                        className="px-3 py-2 text-sm font-medium rounded-md text-gray-500 bg-white border border-gray-300 hover:bg-gray-50"
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                </div>
                
                <button
                  onClick={nextPage}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete Party"
        message="Are you sure you want to delete this party?"
        confirmText="Delete Party"
        cancelText="Cancel"
        variant="danger"
        details={[
          'All party information will be removed',
          'Transaction history will be preserved',
          'Outstanding balance records will remain'
        ]}
      />
    </div>
  );
};

export default PartyMaster;