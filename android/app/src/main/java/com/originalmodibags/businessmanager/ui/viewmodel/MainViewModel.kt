package com.originalmodibags.businessmanager.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.originalmodibags.businessmanager.data.local.entity.BillEntity
import com.originalmodibags.businessmanager.data.local.entity.CustomerEntity
import com.originalmodibags.businessmanager.data.local.entity.ProductEntity
import com.originalmodibags.businessmanager.data.repository.BusinessRepository
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn

/**
 * MainViewModel for Jetpack Compose UI
 * Exposes StateFlows reflecting Room database as the native source of truth.
 */
class MainViewModel(private val repository: BusinessRepository) : ViewModel() {

    val products: StateFlow<List<ProductEntity>> = repository.getProducts()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000L),
            initialValue = emptyList()
        )

    val customers: StateFlow<List<CustomerEntity>> = repository.getCustomers()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000L),
            initialValue = emptyList()
        )

    val bills: StateFlow<List<BillEntity>> = repository.getBills()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000L),
            initialValue = emptyList()
        )
}
