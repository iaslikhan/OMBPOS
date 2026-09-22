package com.originalmodibags.pos

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.originalmodibags.businessmanager.data.local.ModiBagsDatabase
import com.originalmodibags.businessmanager.data.repository.BusinessRepository
import com.originalmodibags.businessmanager.ui.viewmodel.MainViewModel

class MainActivity : ComponentActivity() {
    private lateinit var database: ModiBagsDatabase
    private lateinit var repository: BusinessRepository
    private lateinit var viewModel: MainViewModel

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        database = ModiBagsDatabase.getDatabase(applicationContext)
        repository = BusinessRepository(database)
        viewModel = MainViewModel(repository)

        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    ModiBagsApp()
                }
            }
        }
    }
}

@Composable
fun ModiBagsApp() {
    Text(text = "ORIGINAL MODI BAGS BUSINESS MANAGER")
}
